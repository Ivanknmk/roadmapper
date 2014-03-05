package controllers;

import com.avaje.ebean.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.collect.LinkedListMultimap;
import com.google.common.collect.Multimap;
import com.newrelic.api.agent.NewRelic;
import models.*;
import play.Play;
import play.libs.Json;
import play.mvc.Controller;
import play.mvc.Result;
import play.mvc.Security;
import util.Mail;

import java.sql.Timestamp;
import java.util.*;

@Security.Authenticated(Secured.class)
public class ProblemController extends Controller {

    public static Result getProblem(Long id) {
        Problem problem = Problem.find.byId(id);

        if (problem == null) {
            return notFound();
        }

        // get the tags
        problem.tags = new HashSet<>();
        SqlQuery query = Ebean.createSqlQuery("select tag from problem_tags where problem_id = :problem_id");
        query.setParameter("problem_id", id);
        List<SqlRow> list = query.findList();
        for (SqlRow row : list) {
            problem.tags.add(row.getString("tag"));
        }

        // dress the feature if there is one
        if (problem.feature != null) {
            FeatureController.dressFeature(problem.feature);
        }

        captureCustomAttributes(problem);

        return ok(Json.toJson(problem));
    }

    @play.db.ebean.Transactional
    public static Result updateProblem(Long id) {
        Problem original = Problem.find.byId(id);
        User user = User.findByEmail(request().username());

        if (original == null) {
            return notFound();
        }

        boolean assigneeChanged = false;

        JsonNode json = request().body().asJson();
        Problem update = Json.fromJson(json, Problem.class);
        original.lastModified = new Timestamp(System.currentTimeMillis());
        original.lastModifiedBy = user;
        original.description = update.description;
        original.customerName = update.customerName;
        original.customerEmail = update.customerEmail;
        original.customerCompany = update.customerCompany;
        original.accountId = update.accountId;
        original.annualRevenue = update.annualRevenue;
        original.url = update.url;
        original.state = update.state;
        if (update.feature == null) {
            original.feature = null;
        } else {
            original.feature = Feature.find.byId(update.feature.id);
        }
        if (update.assignee == null) {
            original.assignee = null;
        } else {
            assigneeChanged = original.assignee == null || !update.assignee.email.equals(original.assignee.email);
            original.assignee = User.findByEmail(update.assignee.email);
        }

        original.save();

        // delete tag and then re-add
        SqlUpdate delete = Ebean.createSqlUpdate("delete from problem_tags where problem_id = :problem_id");
        delete.setParameter("problem_id", id);
        delete.execute();
        insertTags(update);

        captureCustomAttributes(original);

        if (assigneeChanged) {
            notifyAssignee(user, original);
        }

        return ok(Json.toJson(original));
    }

    @play.db.ebean.Transactional
    public static Result bulkUpdate() {
        JsonNode json = request().body().asJson();
        ProblemBulkChange bulkChange = Json.fromJson(json, ProblemBulkChange.class);

        if (bulkChange.ids == null || bulkChange.ids.size() == 0) {
            return notFound();
        }

        NewRelic.addCustomParameter("bulk_change_count", bulkChange.ids.size());

        if (bulkChange.assignee != null) {
            NewRelic.addCustomParameter("bulk_change_assignee", bulkChange.assignee.email);

            if ("nobody".equals(bulkChange.assignee.email)) {
                Ebean.createSqlUpdate("update problem set assignee_email = null where id in (:ids)")
                        .setParameter("ids", bulkChange.ids)
                        .execute();
            } else {
                Ebean.createSqlUpdate("update problem set assignee_email = :assignee where id in (:ids)")
                        .setParameter("assignee", bulkChange.assignee.email)
                        .setParameter("ids", bulkChange.ids)
                        .execute();
            }
        }

        if (bulkChange.state != null) {
            NewRelic.addCustomParameter("bulk_change_state", bulkChange.state.name());

            Ebean.createSqlUpdate("update problem set state = :state where id in (:ids)")
                    .setParameter("state", bulkChange.state)
                    .setParameter("ids", bulkChange.ids)
                    .execute();
        }

        if (bulkChange.feature != null) {
            if (bulkChange.feature.id > 0) {
                NewRelic.addCustomParameter("bulk_change_feature", bulkChange.feature.id);
                if (bulkChange.feature.title != null) {
                    NewRelic.addCustomParameter("bulk_change_feature_title", bulkChange.feature.title);
                }

                Ebean.createSqlUpdate("update problem set feature_id = :feature where id in (:ids)")
                        .setParameter("feature", bulkChange.feature.id)
                        .setParameter("ids", bulkChange.ids)
                        .execute();
            } else {
                Ebean.createSqlUpdate("update problem set feature_id = null where id in (:ids)")
                        .setParameter("ids", bulkChange.ids)
                        .execute();
            }
        }

        if (bulkChange.tags != null && !bulkChange.tags.isEmpty()) {
            NewRelic.addCustomParameter("bulk_change_tag_count", bulkChange.tags.size());

            // delete the tags in case they already exist...
            Ebean.createSqlUpdate("delete from problem_tags where problem_id in (:ids) and tag in (:tags)")
                    .setParameter("ids", bulkChange.ids)
                    .setParameter("tags", bulkChange.tags)
                    .execute();

            // .. and now re-insert them
            SqlUpdate tagInsert = Ebean.createSqlUpdate("insert into problem_tags (problem_id, tag) values (:id, :tag)");
            for (String tag : bulkChange.tags) {
                for (Long id : bulkChange.ids) {
                    tagInsert.setParameter("id", id).setParameter("tag", tag).execute();
                }
            }
        }

        return ok();
    }

    @play.db.ebean.Transactional
    public static Result bulkDelete() {
        JsonNode json = request().body().asJson();
        ProblemBulkChange bulkChange = Json.fromJson(json, ProblemBulkChange.class);

        if (bulkChange.ids == null || bulkChange.ids.size() == 0) {
            return notFound();
        }

        NewRelic.addCustomParameter("bulk_change_count", bulkChange.ids.size());

        for (Long id : bulkChange.ids) {
            deleteProblem(id, false);
        }

        return ok();
    }

    public static Result find() {
        if (!request().queryString().containsKey("query")) {
            return ok();
        }

        String query = request().queryString().get("query")[0];
        if (query.equals("")) {
            return ok();
        }

        Integer limit = null;
        if (request().queryString().get("limit") != null) {
            limit = Integer.parseInt(request().queryString().get("limit")[0]);
        }

        ExpressionList<Problem> where = Problem.find.where();
        String[] terms = query.split(",");

        int tagsSeen = 0;
        Multimap<Long, Boolean> tagMatchCount = LinkedListMultimap.create();
        Map<Long, Float> rankings = null;

        for (String term : terms) {
            if (term.startsWith("state:")) {
                ProblemState state = ProblemState.valueOf(term.substring(6).toUpperCase());
                where.eq("state", state);
            } else if (term.startsWith("description:")) {
                where.ilike("description", "%" + term.substring(12) + "%");
            } else if (term.startsWith("reporter:")) {
                where.eq("reporter_email", term.substring(9));
            } else if (term.startsWith("company:")) {
                where.ilike("customerCompany", "%" + term.substring(8) + "%");
            } else if (term.startsWith("email:")) {
                where.ilike("customerEmail", "%" + term.substring(6) + "%");
            } else if (term.startsWith("user:")) {
                where.ilike("customerName", "%" + term.substring(5) + "%");
            } else if (term.startsWith("assignedTo:")) {
                // todo: this t0 stuff is really ghetto and I'm only doing it because the same column
                // exists with problems and features and the advice on this thread doesn't seem to be working
                // https://groups.google.com/forum/#!topic/ebean/Ot9WtPNIhGI
                String str = term.substring(11);
                switch (str) {
                    case "null":
                        where.isNull("t0.assignee_email");
                        break;
                    case "not-null":
                        where.isNotNull("t0.assignee_email");
                        break;
                    default:
                        where.eq("t0.assignee_email", str);
                        break;
                }
            } else if (term.startsWith("accountId:")) {
                try {
                    long accountId = Long.parseLong(term.substring(10));
                    where.eq("accountId", accountId);
                } catch (NumberFormatException e) {
                    // ignore
                }
            } else if (term.startsWith("featureId:")) {
                String str = term.substring(10);

                switch (str) {
                    case "null":
                        where.isNull("feature.id");
                        break;
                    case "not-null":
                        where.isNotNull("feature.id");
                        break;
                    default:
                        try {
                            long featureId = Long.parseLong(str);
                            where.eq("feature.id", featureId);
                        } catch (NumberFormatException e) {
                            // ignore
                        }
                        break;
                }
            } else if (term.startsWith("text:")) {
                rankings = new HashMap<>();
                String tsquery = term.substring(5);
                tsquery = tsquery.replaceAll("[\\|\\&\\!\\:']", "-")
                        .replaceAll("[ \t\n\r]", "|");

                SqlQuery searchQuery = Ebean.createSqlQuery("select id, ts_rank_cd(textsearch, query) rank from (select id, setweight(to_tsvector(coalesce((select string_agg(tag, ' ') from problem_tags where problem_id = id),'')), 'A') || setweight(to_tsvector(coalesce(description,'')), 'B') as textsearch from problem) t, to_tsquery(:tsquery) query where textsearch @@ query order by rank desc");
                searchQuery.setParameter("tsquery", tsquery);
                if (limit != null) {
                    searchQuery.setMaxRows(limit);
                }
                List<SqlRow> list = searchQuery.findList();
                for (SqlRow row : list) {
                    rankings.put(row.getLong("id"), row.getFloat("rank"));
                }
            } else {
                // no prefix? assume a tag then
                tagsSeen++;

                // note: this is a back door to cause the transaction to (most likely) show up as a TT in New Relic.
                if (term.startsWith("force-freeze-")) {
                    try {
                        Thread.sleep(Long.parseLong(term.substring(13)));
                    } catch (InterruptedException e) {
                        Thread.interrupted();
                    }

                    continue;
                }

                SqlQuery tagQuery = Ebean.createSqlQuery("select problem_id from problem_tags where tag = :tag");
                tagQuery.setParameter("tag", term);
                List<SqlRow> list = tagQuery.findList();
                for (SqlRow row : list) {
                    Long problemId = row.getLong("problem_id");
                    tagMatchCount.put(problemId, true);
                }
            }
        }

        if (tagsSeen > 0) {
            Set<Long> problemIds = new HashSet<>();
            for (Long problemId : tagMatchCount.keySet()) {
                System.out.println("problemId  = " + problemId + "; count = " + tagMatchCount.get(problemId).size());
                if (tagMatchCount.get(problemId).size() == tagsSeen) {
                    problemIds.add(problemId);
                }
            }

            if (!problemIds.isEmpty()) {
                where.in("id", problemIds);
            } else {
                // nothing matched, game over man!
                return ok();
            }
        }

        if (rankings != null) {
            if (rankings.isEmpty()) {
                return ok();
            }

            where.in("id", rankings.keySet());
        }

        // fixes N+1 query problem
        where.join("reporter");
        where.join("lastModifiedBy");
        where.join("feature");

        if (limit != null) {
            where.setMaxRows(limit);
        }

        List<Problem> list = where.findList();

        if (rankings != null) {
            for (Problem problem : list) {
                problem.rank = rankings.get(problem.id);
            }
        }

        return ok(Json.toJson(list));
    }

    @play.db.ebean.Transactional
    public static Result create() {
        User user = User.findByEmail(request().username());

        JsonNode json = request().body().asJson();

        Problem problem = Json.fromJson(json, Problem.class);
        problem.date = new Date();
        problem.lastModified = new Timestamp(problem.date.getTime());
        problem.reporter = problem.lastModifiedBy = user;
        problem.state = ProblemState.OPEN;

        problem.save();
        insertTags(problem);

        captureCustomAttributes(problem);

        if (problem.assignee != null) {
            notifyAssignee(user, problem);
        }

        return ok(Json.toJson(problem));
    }

    private static void insertTags(Problem problem) {
        // now save the tags
        if (problem.tags != null && !problem.tags.isEmpty()) {
            SqlUpdate update = Ebean.createSqlUpdate("insert into problem_tags (problem_id, tag) values (:problem_id, :tag)");
            for (String tag : problem.tags) {
                update.setParameter("problem_id", problem.id);
                update.setParameter("tag", tag);
                update.execute();
            }
        }
    }

    @play.db.ebean.Transactional
    public static Result deleteProblem(Long id) {
        return deleteProblem(id, true);
    }

    private static Result deleteProblem(Long id, boolean captureCustomAttributes) {
        Problem problem = Problem.find.ref(id);
        if (captureCustomAttributes) {
            captureCustomAttributes(problem);
        }

        // Dissociate tags
        SqlUpdate deleteTags = Ebean.createSqlUpdate("delete from problem_tags where problem_id = :problem_id");
        deleteTags.setParameter("problem_id", id);
        deleteTags.execute();

        // and delete it
        problem.delete();

        return ok();
    }

    private static void captureCustomAttributes(Problem problem) {
        NewRelic.addCustomParameter("problem_state", problem.state.name());

        if (problem.id != null) {
            NewRelic.addCustomParameter("problem", problem.id);
        }

        if (problem.annualRevenue != null) {
            NewRelic.addCustomParameter("problem_arr", problem.annualRevenue);
        }

        if (problem.accountId != null) {
            NewRelic.addCustomParameter("problem_account", problem.accountId);
        }

        if (problem.customerEmail != null) {
            NewRelic.addCustomParameter("problem_customer", problem.customerEmail);
        }

        if (problem.customerCompany != null) {
            NewRelic.addCustomParameter("problem_customer_company", problem.customerCompany);
        }

        if (problem.customerName != null) {
            NewRelic.addCustomParameter("problem_customer_name", problem.customerName);
        }

        captureCustomUserAttributes("problem_assignee", problem.assignee);
        captureCustomUserAttributes("problem_reporter", problem.reporter);
        captureCustomUserAttributes("problem_modifiedBy", problem.lastModifiedBy);
    }

    private static void captureCustomUserAttributes(String type, User user) {
        if (user == null) {
            return;
        }

        NewRelic.addCustomParameter(type, user.email);
        NewRelic.addCustomParameter(type + "_name", user.name);
    }

    private static void notifyAssignee(User user, Problem problem) {
        StringBuilder body = new StringBuilder();

        String root = Play.application().configuration().getString("root.url");
        body.append(root).append("#/problems/").append(problem.id).append("\n");
        body.append("\n");

        body.append("Customer: ").append(problem.customerName).append(" <").append(problem.customerEmail).append("> / ").append(problem.customerCompany).append("\n");
        if (problem.accountId != null) {
            body.append("Account ID: ").append(problem.accountId).append("\n");
        }
        if (problem.annualRevenue != null) {
            body.append("ARR: ").append(problem.annualRevenue).append("\n");
        }
        body.append("State: ").append(problem.state).append("\n");
        if (problem.url != null) {
            body.append("URL: ").append(problem.url).append("\n");
        }
        body.append("Reporter: ").append(problem.reporter.name).append(" <").append(problem.reporter.email).append(">\n");
        if (problem.tags != null) {
            body.append("Tags: ");
            for (String tag : problem.tags) {
                body.append(tag).append(" ");
            }
            body.append("\n");
        }

        if (problem.feature != null) {
            body.append("Feature: ").append(problem.feature.title).append("\n");
            body.append(root).append("#/features/").append(problem.feature.id).append("\n");

        }

        body.append("\n");
        body.append(problem.description);

        Mail.send(user, problem.assignee, "[Roadmapper] Problem " + problem.id + " Assigned", body.toString());
    }

}
