console.log("problems.js loading");

function ProblemsCtrl($scope, $http) {
    $scope.search = function () {
        $http.get('/problems', {
            params: {
                query: $scope.query.map(function(e) { return e.id } ).join(",")
            }
        }).success(function (problems) {
                $scope.problems = problems;
            });
    };

    $scope.query = [{id: "state:OPEN", text: "<strong>State</strong>: OPEN"}];
    $scope.$watch("query", $scope.search);

    var sortHack = function(tag) {
        if (tag.indexOf("state:") == 0) {
            return "00000" + tag;
        } else if (tag.indexOf("accountId:") == 0) {
            return "11111" + tag;
        } else if (tag.indexOf("company:") == 0) {
            return "22222" + tag;
        } else if (tag.indexOf("user:") == 0) {
            return "33333" + tag;
        } else if (tag.indexOf("email:") == 0) {
            return "44444" + tag;
        } else if (tag.indexOf("description:") == 0) {
            return "55555" + tag;
        } else {
            return "66666" + tag;
        }
    };

    $scope.querySelect2Options = {
        multiple: true,
        sortResults: function(results, container, query) {
            if (query.term) {
                return results.sort(function(a, b) {
                    // this is lame but it works
                    var tag1 = sortHack(a.id);
                    var tag2 = sortHack(b.id);

                    if (tag1 < tag2) {
                        return -1;
                    } else if (tag1 > tag2) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
            }

            return results;
        },
        createSearchChoice: function(val) {
            if (val.length>0) {
                return {id: val, text: "<strong>Tag</strong>: " + val};
            } else {
                return null;
            }
        },
        tags: [],
        tokenSeparators: [",", " "],
        query: function (query) {
            var term = query.term;
            if (term == "") {
                query.callback({results: []});
                return;
            }

            var results = [];

            // always offer description matching
            results.push({id: "description:" + term, text: "<strong>Description</strong>: " + term});

            // always offer account name matching
            results.push({id: "company:" + term, text: "<strong>Company</strong>: " + term});

            // always offer user name matching
            results.push({id: "user:" + term, text: "<strong>User</strong>: " + term});

            // if there is an "@", offer email matching
            if (term.indexOf("@") != -1) {
                results.push({id: "email:" + term, text: "<strong>Email</strong>: " + term});
            }

            // if it's a number, match account ID
            if (/^\-?\d*$/.test(term)) {
                results.push({id: "accountId:" + term, text: "<strong>Account ID</strong>: " + term});
            }

            // status matching
            enumProblemStates.map(function(e) {
                if (e.match(new RegExp(".*" + term + ".*", "i"))) {
                    results.push({id: "state:" + e, text: "<strong>State</strong>: " + e});
                }
            });

            $http.get("/tags?query=" + term)
                .success(function (tags) {
                    tags.map(function(tag) {results.push({id: tag, text: "<strong>Tag</strong>: " + tag})});
                    query.callback({
                        results: results
                    });
                })
                .error(function () {
                    debugger;
                });
        },
        formatSelection: function(object, container) {
            return object.text;
        },
        formatResult: function(object, container) {
            return object.text;
        }
    };


    $scope.showNewProblemModal = function() {
        $scope.showNewProblem = true;
    };

    $scope.createProblem = function (problem) {

        throw "blah blah";

        // convert tags from select2 {id: ..., text: ...} format to just simple array of raw tag value
        var copy = angular.copy(problem);
        copy.tags = [];
        problem.tags.map(function(tag) {copy.tags.push(tag.id)});

        $http.post('/problems', copy)
            .success(function (returnedProblem) {
                $scope.openProblems.push(returnedProblem);

                $scope.showNewProblem = false;
            })
            .error(function () {
                debugger;
            });
    };

    $scope.closeNewProblem = function() {
        $scope.newProblem = null;
        $scope.showNewProblem = false;
    };

    $scope.modalOptions = {
        backdropFade: true,
        dialogFade: true,
        dialogClass: 'modal modal-problem'
    };

    $scope.editProblem = function(problem) {
        $scope.selectedProblem = problem;
        $http.get('/problems/' + problem.id)
            .success(function(problemWithTags) {
                // convert tag from simple raw values to select2-compatible object
                var rawTags = problemWithTags.tags;
                problemWithTags.tags = [];
                rawTags.map(function(tag) {problemWithTags.tags.push({id: tag, text: tag})});

                $scope.selectedProblem = problemWithTags;
                $scope.showViewProblem = true;
            });
    };

    $scope.saveProblem = function(problem) {
        // convert tags from select2 {id: ..., text: ...} format to just simple array of raw tag value
        var copy = angular.copy(problem);
        copy.tags = [];
        problem.tags.map(function(tag) {copy.tags.push(tag.id)});

        $http.put('/problems/' + problem.id, copy)
            .success(function() {
                //todo
                $scope.showViewProblem = false;
            })
            .error(function() {
                debugger;
            })
    };

    $scope.closeViewProblem = function() {

        $scope.showViewProblem = false;
    };

    $scope.select2Options = {
        multiple: true,
        createSearchChoice: function(val) {
            if (val.length>0) {
                return {id: val, text: val};
            } else {
                return null;
            }
        },
        tags: [],
        tokenSeparators: [",", " "],
        query: function (query) {
            console.log("in query function2");
            $http.get("/tags?query=" + query.term)
                .success(function (tags) {
                    var results = [];
                    tags.map(function(tag) {results.push({id: tag, text: tag})});
                    query.callback({
                        results: results
                    });
                })
                .error(function () {
                    debugger;
                });
        },
        formatNoMatches: function(){ return 'empty';}
    };
}
