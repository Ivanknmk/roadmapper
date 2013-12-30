// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

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

roadmapper.directive('integer', function() {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                ctrl.$parsers.unshift(function(viewValue) {
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

roadmapper.filter('truncate', function() {
        return function(input, length) {
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

roadmapper.filter('minlinks', function() {
        return function(input) {
            return input.replace(LINK_EXPRESSION, "<link>");
        }
    });

roadmapper.filter('size', function() {
        return function(input) {
            if (input == null) {
                return "";
            }

            return input.substring(0, 1);
        }
    });

roadmapper.filter('shortQuarter', function() {
        return function(qtr) {
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

roadmapper.filter('longQuarter', function() {
        return function(qtr) {
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

roadmapper.run(function ($rootScope, $http, $cookieStore, $location) {
        // wire up shared enums
        $rootScope.enumAllQuarters = enumAllQuarters;
        $rootScope.enumActiveQuarters = enumActiveQuarters;
        $rootScope.enumSizes = enumSizes;
        $rootScope.enumProblemStates = enumProblemStates;
        $rootScope.enumFeatureStates = enumFeatureStates;

        var counter = 1;

        // wire up shared select2 configs
        $rootScope.tagSelect2Options = {
            multiple: true,
            simple_tags: true,
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
                counter++;
                var cur = counter;
                $http.get("/tags?query=" + query.term)
                    .success(function (tags) {
                        if (cur != counter) {
                            //console.log("discarding: " +  cur + " != " + counter);
                            return;
                        }
                        //console.log("keeping: " + cur + " == " + counter);

                        var results = [];
                        tags.map(function(tag) {results.push({id: tag, text: tag})});
                        query.callback({
                            results: results
                        });
                    }).error(LogHandler($rootScope));
            },
            formatNoMatches: function(){ return 'empty';}
        };

        $rootScope.teamSelect2Options = {
            allowClear: true,
            query: function (query) {
                $http.get("/teams")
                    .success(function (teams) {
                        var results = [];
                        teams.map(function(team) {results.push({id: team.id, text: team.name})});
                        query.callback({
                            results: results
                        });
                    }).error(LogHandler($rootScope));
            }
        };



        // set up i18n bundle
        $rootScope.i18n = i18n;

        $rootScope.user = user;

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

function FormErrorHandler($scope) {
    return function(data, status, headers) {
        $scope.errors = [data.globalError];
    }
}

function ClearErrors($scope) {
    $scope.errors = null;
}

function LogHandler($scope) {
    return function(data, status, headers, config) {
        // todo: we could do more here
        console.log("Got back " + status + " while requesting " + config.url);
    }
}

function DashboardCtrl($scope, $http) {
    $http.get('/dashboard-stats')
        .success(function (stats) {
            $scope.stats = stats;
        }).error(LogHandler($scope));
}