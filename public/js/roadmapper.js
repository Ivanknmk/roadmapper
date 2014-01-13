// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

function debouncer(func, timeout) {
    var timeoutID , timeout = timeout || 200;
    return function () {
        var scope = this , args = arguments;
        clearTimeout(timeoutID);
        timeoutID = setTimeout(function () {
            func.apply(scope, Array.prototype.slice.call(args));
        }, timeout);
    }
}

var LINK_EXPRESSION = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

var roadmapper = angular.module('roadmapper', ["ngRoute", "ngCookies", "ui.bootstrap", "ui.select2", "roadmapper.ui.select2"]);

roadmapper.config(['$routeProvider', function ($routeProvider) {
    $routeProvider.
        when('/dashboard', {controller: DashboardCtrl, templateUrl: templateUrls.dashboard}).
        when('/problems', {controller: ProblemsCtrl, templateUrl: templateUrls.problems}).
        when('/problems/new', {controller: NewProblemCtrl, templateUrl: templateUrls.newProblem}).
        when('/problems/:problemId', {controller: ViewProblemCtrl, templateUrl: templateUrls.viewProblem}).
        when('/features', {controller: FeaturesCtrl, templateUrl: templateUrls.features}).
        when('/features/new', {controller: NewFeatureCtrl, templateUrl: templateUrls.newFeature}).
        when('/features/:featureId', {controller: ViewFeatureCtrl, templateUrl: templateUrls.viewFeature}).
        when('/teams', {controller: TeamsCtrl, templateUrl: templateUrls.teams}).
        when('/tags', {controller: TagsCtrl, templateUrl: templateUrls.tags}).
        otherwise({redirectTo: '/dashboard'});
}]);

function NavBarCtrl($scope) {
    $scope.isCollapsed = true;
}

roadmapper.factory('userAgentService', function ($window) {
    var service = {
        iOS: false,
        iPad: false,
        iPhone: false,
        iPod: false
    };

    if ($window.navigator.platform) {
        var platform = $window.navigator.platform.replace(" Simulator", "");

        var iDevice = ['iPad', 'iPhone', 'iPod'];

        for (var i = 0; i < iDevice.length; i++) {
            if (platform === iDevice[i]) {
                service.iOS = true;
                service[iDevice[i]] = true;
                break;
            }
        }
    }


    return service;
});

roadmapper.factory('sorter', function ($parse) {
    var sorter = function (predicate, reverse, tiebreaker) {
        return function (a, b) {
            var a1 = $parse(predicate)(a);

            if (a1 && a1.toLowerCase) {
                a1 = a1.toLowerCase();
            }

            var b1 = $parse(predicate)(b);
            if (b1 && b1.toLowerCase) {
                b1 = b1.toLowerCase();
            }

            if (a1 == null) {
                a1 = "";
            }

            if (b1 == null) {
                b1 = "";
            }

            if (!reverse) {
                if (a1 == b1) {
                    if (tiebreaker) {
                        return sorter(tiebreaker, reverse)(a,b);
                    } else {
                        return 0;
                    }
                } else {
                    return a1 > b1 ? 1 : -1;
                }
            } else {
                if (a1 == b1 && tiebreaker) {
                    if (tiebreaker) {
                        return sorter(tiebreaker, reverse)(a,b);
                    } else {
                        return 0;
                    }
                } else {
                    return a1 > b1 ? -1 : 1;
                }
            }
        }
    };

    return  sorter;
});


roadmapper.directive("cmdEnter", function () {
    return function (scope, element, attrs) {
        element.bind("keydown keypress", function (event) {
            if ((event.metaKey || event.ctrlKey) && event.keyCode == 13) {
                scope.$apply(function () {
                    scope.$eval(attrs.cmdEnter);
                });

                event.preventDefault();
            }
        });
    };
});

roadmapper.directive('integer', function () {
    return {
        require: 'ngModel',
        link: function (scope, elm, attrs, ctrl) {
            ctrl.$parsers.unshift(function (viewValue) {
                if (/^\-?\d*$/.test(viewValue)) {
                    // it is valid
                    ctrl.$setValidity('integer', true);
                    return viewValue;
                } else {
                    // it is invalid, return undefined (no model update)
                    ctrl.$setValidity('integer', false);
                    return undefined;
                }
            });
        }
    };
});

roadmapper.filter('noFractionCurrency',
    [ '$filter', '$locale',
        function (filter, locale) {
            var currencyFilter = filter('currency');
            var formats = locale.NUMBER_FORMATS;
            return function (amount, currencySymbol) {
                var value = currencyFilter(amount, currencySymbol);
                var sep = value.indexOf(formats.DECIMAL_SEP);
                if (amount >= 0) {
                    return value.substring(0, sep);
                }
                return value.substring(0, sep) + ')';
            };
        } ]);

roadmapper.filter('truncate', function () {
    return function (input, length) {
        if (input == null) {
            return "";
        }

        if (input.length + 4 < length) {
            return input;
        } else {
            return input.substring(0, length) + " ...";
        }
    }
});

roadmapper.filter('minlinks', function () {
    return function (input) {
        return input.replace(LINK_EXPRESSION, "<link>");
    }
});

roadmapper.filter('size', function () {
    return function (input) {
        if (input == null) {
            return "";
        }

        return input.substring(0, 1);
    }
});

roadmapper.filter('shortQuarter', function () {
    return function (qtr) {
        if (qtr == null) {
            return null;
        }

        for (var i = 0; i < enumAllQuarters.length; i++) {
            var quarter = enumAllQuarters[i];
            if (quarter.id == qtr) {
                return quarter.label.substring(0, 2);
            }
        }

        return null;
    }
});

roadmapper.filter('longQuarter', function () {
    return function (qtr) {
        if (qtr == null) {
            return null;
        }

        for (var i = 0; i < enumAllQuarters.length; i++) {
            var quarter = enumAllQuarters[i];
            if (quarter.id == qtr) {
                return quarter.label;
            }
        }

        return null;
    }
});

roadmapper.run(function ($rootScope, $http, $q, sorter) {
    // wire up shared enums
    $rootScope.enumAllQuarters = enumAllQuarters;
    $rootScope.enumActiveQuarters = enumActiveQuarters;
    $rootScope.enumSizes = enumSizes;
    $rootScope.enumProblemStates = enumProblemStates;
    $rootScope.enumFeatureStates = enumFeatureStates;

    var canceler = null;
    // wire up shared select2 configs
    $rootScope.tagSelect2Options = {
        multiple: true,
        simple_tags: true,
        sortResults: function(results, container, query) {
            return results.sort(sorter("rank", false, "id"));
        },
        createSearchChoice: function (val) {
            if (val.length > 0) {
                return {id: val, text: val, rank: 2};
            } else {
                return null;
            }
        },
        tags: [],
        tokenSeparators: [",", " "],
        query: function (query) {
            if (canceler != null) {
                canceler.resolve();
            }
            canceler = $q.defer();
            $http.get("/tags?query=" + query.term, {timeout: canceler.promise})
                .success(function (tags) {
                    var results = tags.map(function (tag) {
                        var rank = 3;
                        if (tag == query.term) {
                            rank = 1;
                        }
                        return {id: tag, text: tag, rank: rank};
                    });
                    if (results.length) {
                        results[0].rank = 1;
                    }
                    query.callback({
                        results: results
                    });
                }).error(LogHandler($rootScope));
        },
        formatNoMatches: function () {
            return 'empty';
        }
    };

    $rootScope.productManagers = [];
    $http.get("/users?role=PM")
        .success(function (users) {
            $rootScope.productManagers = users;
        }).error(LogHandler($rootScope));

    // set up i18n bundle
    $rootScope.i18n = i18n;

    $rootScope.user = user;

    $rootScope.checkRole = function(role) {
        return role == user.role;
    };

    // segment.io
    analytics.identify(user.email, {
        name: user.name,
        email: user.email,
        firstLogin: user.firstLogin
    });

    // mixpanel stuff
    mixpanel.set_config({track_pageview: false});
    mixpanel.identify(user.email);
    mixpanel.register({
        "User Email": user.email,
        "User Name": user.name
    });
    mixpanel.people.set("$email", user.email);
    mixpanel.people.set("$username", user.email);
    mixpanel.people.set("$name", user.name);
    mixpanel.people.set("$created", new Date(user.firstLogin));
    mixpanel.people.increment("Sessions");
    mixpanel.name_tag(user.name);
});

function makeTeamSelect2Options(scope, http, includeRemove) {
    return {
        allowClear: true,
        sortResults: function(results, container, query) {
            return results.sort(function(a, b) {
                if (a.id == -1) {
                    return -1;
                } else if (b.id == -1) {
                    return 1;
                }

                if (a.text == b.text) {
                    return 0;
                } else {
                    return a.text > b.text ? 1 : -1;
                }
            });
        },
        formatSelection: function(object, container) {
            return object.text;
        },
        formatResult: function(object, container) {
            return object.text;
        },
        query: function (query) {
            http.get("/teams")
                .success(function (teams) {
                    var term = query.term || "";

                    var results = [];
                    if (includeRemove) {
                        results.push({id: -1, text: "<strong>*** Remove team ***</strong>", rank: 1000});
                    }

                    teams.filter(function(team) {
                        return team.name.toLowerCase().indexOf(term) != -1;
                    }).map(function (team) {
                        results.push({id: team.id, text: team.name})
                    });

                    query.callback({
                        results: results
                    });
                }).error(LogHandler(scope));
        }
    };
}

function makeFeatureSelect2Options(scope, http, includeRemove, sorter) {
    return {
        allowClear: true,
        sortResults: function(results, container, query) {
            return results.sort(sorter("rank", true, "id"));
        },
        formatSelection: function(object, container) {
            return object.text;
        },
        formatResult: function(object, container) {
            var text = "<div><span>" + object.text + "</span>";
            if (object.team) {
                text += "<span style='float: right'><i>" + object.team +  "</i></span>";
            }
            text += "</div>";

            return text;
        },
        query: function (query) {
            var term = query.term;

            // no term initially? that's cool -- we'll borrow the tags (if any) as a convenience
            if (term == "" && scope.problem) {
                term = scope.problem.tags.map(function(tag) { return tag.id; }).join(" ");
            }

            http.get("/features?limit=20&query=state:OPEN,text:" + term)
                .success(function (features) {
                    var results;
                    if (features) {
                        results = features.map(function(feature) {
                            var result = {id: feature.id, text: feature.title, rank: feature.rank};
                            if (feature.team) {
                                result.team = feature.team.name;
                            }

                            return  result;
                        });
                    } else {
                        results = [];
                    }

                    if (includeRemove) {
                        results.push({id: -1, text: "<strong>*** Remove feature mapping ***</strong>", rank: 1000});
                    }

                    query.callback({
                        results: results
                    });
                }).error(LogHandler(scope));
        }
    };
}

function makeAssigneeSelect2Options(scope, includeRemove) {
    return {
        allowClear: true,
        sortResults: function(results, container, query) {
            return results.sort(function(a, b) {
                if (a.id == "nobody") {
                    return -1;
                } else if (b.id == "nobody") {
                    return 1;
                }

                if (a.id == b.id) {
                    return 0;
                } else {
                    return a.id > b.id ? 1 : -1;
                }
            });
        },
        formatSelection: function(object, container) {
            return object.text;
        },
        formatResult: function(object, container) {
            return object.text;
        },
        query: function (query) {
            var data = scope.productManagers.map(function (user) {
                return {id: user.email, text: user.name};
            });

            if (query.term) {
                var term = query.term.toLowerCase();
                data = data.filter(function (e) {
                    return e.id.toLowerCase().indexOf(term) != -1 ||
                        e.text.toLowerCase().indexOf(term) != -1;
                });
            }

            if (includeRemove) {
                data.push({id: "nobody", text: "<strong>*** Remove assignee ***</strong>"});
            }

            query.callback({
                results: data
            });
        }
    };
}

function FormErrorHandler($scope) {
    return function (data, status, headers) {
        $scope.errors = [data.globalError];
    }
}

function ClearErrors($scope) {
    $scope.errors = null;
}

function LogHandler($scope) {
    return function (data, status, headers, config) {
        // todo: we could do more here
        console.log("Got back " + status + " while requesting " + config.url);
    }
}

function DashboardCtrl($scope, $http, problemService, $location) {
    var nameFromEmail = function(email) {
        var match = $scope.productManagers.filter(function(user) {
            return user.email == email;
        });
        if (match.length > 0) {
            return match[0].name;
        } else {
            return email;
        }
    };
    $scope.nameFromEmail = nameFromEmail;

    $scope.unassignedOpenProblems = function() {
        problemService.query = [
            {id: "state:OPEN", text: "<strong>State</strong>: OPEN"},
            {id: "assignedTo:null", text: "<strong>Unassigned</strong>"}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $scope.openProblems = function(email) {
        problemService.query = [
            {id: "state:OPEN", text: "<strong>State</strong>: OPEN"},
            {id: "assignedTo:" + email, text: "<strong>Assigned To: </strong>" + nameFromEmail(email)}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $scope.reviewedProblems = function(email) {
        problemService.query = [
            {id: "state:REVIEWED", text: "<strong>State</strong>: REVIEWED"},
            {id: "assignedTo:" + email, text: "<strong>Assigned To: </strong>" + nameFromEmail(email)}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $scope.reviewedUnmappedProblems = function(email) {
        problemService.query = [
            {id: "state:REVIEWED", text: "<strong>State</strong>: REVIEWED"},
            {id: "featureId:null", text: "<strong>Feature Not Mapped</strong>"},
            {id: "assignedTo:" + email, text: "<strong>Assigned To: </strong>" + nameFromEmail(email)}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $scope.resolvedProblems = function(email) {
        problemService.query = [
            {id: "state:RESOLVED", text: "<strong>State</strong>: RESOLVED"},
            {id: "assignedTo:" + email, text: "<strong>Assigned To: </strong>" + nameFromEmail(email)}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $scope.notifiedProblems = function(email) {
        problemService.query = [
            {id: "state:NOTIFIED", text: "<strong>State</strong>: NOTIFIED"},
            {id: "assignedTo:" + email, text: "<strong>Assigned To: </strong>" + nameFromEmail(email)}
        ];
        problemService.search();
        $location.path("/problems");
    };

    $http.get('/dashboard-stats')
        .success(function (stats) {
            $scope.stats = stats;
        }).error(LogHandler($scope));
}