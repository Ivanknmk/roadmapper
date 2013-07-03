package controllers;

import com.avaje.ebean.*;
import com.google.common.collect.LinkedListMultimap;
import com.google.common.collect.Multimap;
import models.Problem;
import models.ProblemState;
import models.User;
import org.codehaus.jackson.JsonNode;
import play.libs.Json;
import play.mvc.Controller;
import play.mvc.Result;
import play.mvc.Security;

import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Security.Authenticated(Secured.class)
public class ProblemController extends Controller {

    public static Result findOpen() {
        return findByState(ProblemState.OPEN);
    }

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

        return ok(Json.toJson(problem));
    }

    @play.db.ebean.Transactional
    public static Result updateProblem(Long id) {
        Problem original = Problem.find.byId(id);

        if (original == null) {
            return notFound();
        }

        JsonNode json = request().body().asJson();
        Problem update = Json.fromJson(json, Problem.class);
        original.description = update.description;
        original.accountId = update.accountId;
        original.annualRevenue = update.annualRevenue;
        original.url = update.url;

        // todo: feature???
        original.save();

        System.out.println("!!!!!!!!!!!!!!!!!");

        // delete tag and then re-add
        SqlUpdate delete = Ebean.createSqlUpdate("delete from problem_tags where problem_id = :problem_id");
        delete.setParameter("problem_id", id);
        delete.execute();
        insertTags(update);

        return ok();
    }

    private static Result findByState(ProblemState state) {
        List<Problem> problems = Problem.find.where()
                .eq("state", state)
                .findList();

        return ok(Json.toJson(problems));
    }

    public static Result find() {
        if (!request().queryString().containsKey("query")) {
            // todo: not sure this is a good idea, might get too large
            return ok(Json.toJson(Problem.find.all()));
        }

        String query = request().queryString().get("query")[0];

        ExpressionList<Problem> where = Problem.find.where();
        String[] terms = query.split(",");

        int tagsSeen = 0;
        Multimap<Long, Boolean> tagMatchCount = LinkedListMultimap.create();

        for (String term : terms) {
            if (term.startsWith("state:")) {
                ProblemState state = ProblemState.valueOf(term.substring(6).toUpperCase());
                where.eq("state", state);
            } else if (term.startsWith("description:")) {
                where.ilike("description", "%" + term.substring(12) + "%");
            } else if (term.startsWith("company:")) {
                where.ilike("customerCompany", "%" + term.substring(8) + "%");
            } else if (term.startsWith("email:")) {
                where.ilike("customerEmail", "%" + term.substring(6) + "%");
            } else if (term.startsWith("user:")) {
                where.ilike("customerName", "%" + term.substring(5) + "%");
            } else if (term.startsWith("accountId:")) {
                try {
                    long accountId = Long.parseLong(term.substring(10));
                    where.eq("accountId", accountId);
                } catch (NumberFormatException e) {
                    // ignore
                }
            } else {
                // no prefix? assume a tag then
                tagsSeen++;

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
                if (tagMatchCount.get(problemId).size() == tagsSeen) {
                    problemIds.add(problemId);
                }
            }

            if (!problemIds.isEmpty()) {
                where.in("id", problemIds);
            }
        }

        return ok(Json.toJson(where.findList()));
    }

    public static Result create() {
        JsonNode json = request().body().asJson();

        Problem problem = Json.fromJson(json, Problem.class);
        problem.date = new Date();
        problem.reporter = User.findByEmail(request().username());

        problem.state = ProblemState.OPEN;

        problem.save();
        insertTags(problem);


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
}
