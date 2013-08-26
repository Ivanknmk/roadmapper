// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function (from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};

angular.module('roadmapper', ["ngCookies", "ui.bootstrap", "ui.select2"]).
    config(function ($routeProvider) {
        $routeProvider.
            when('/dashboard', {controller: DashboardCtrl, templateUrl: 'templates/dashboard.html'}).
            when('/profile', {controller: ProfileCtrl, templateUrl: 'templates/profile.html'}).
            when('/problems', {controller: ProblemsCtrl, templateUrl: 'templates/problems.html'}).
            when('/problems/:problemId', {controller: ProblemsCtrl, templateUrl: 'templates/problems.html'}).
            when('/features', {controller: FeaturesCtrl, templateUrl: 'templates/features.html'}).
            when('/features/:featureId', {controller: FeaturesCtrl, templateUrl: 'templates/features.html'}).
            when('/teams', {controller: TeamsCtrl, templateUrl: 'templates/teams.html'}).
            otherwise({redirectTo: '/dashboard'});
    })
    .directive('integer', function() {
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
    })
    .directive("navbar", function () {
        return {

            controller: function ($scope, $location, $rootScope, $cookieStore) {
                $scope.dashboard = function () {
                    $location.path("/dashboard");
                };

                $scope.problems = function () {
                    $location.path("/problems");
                };

                $scope.features = function () {
                    $location.path("/features");
                };

                $scope.teams = function () {
                    $location.path("/teams");
                };

                $scope.profile = function () {
                    $location.path("/profile");
                };

                $scope.logout = function () {
                    window.location.href = "/logout"
                };
            },
            templateUrl: "templates/navbar.html"
        }
    })
    .filter('noFractionCurrency',
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
            } ])
    .filter('truncate', function() {
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
    })
    .run(function ($rootScope, $http, $cookieStore, $location) {
        $rootScope.query = [{id: "state:OPEN", text: "<strong>State</strong>: OPEN"}];
        $rootScope.featureQuery = [{id: "state:OPEN", text: "<strong>State</strong>: OPEN"}];

        // wire up shared enums
        $rootScope.enumQuarters = enumQuarters;
        $rootScope.enumSizes = enumSizes;
        $rootScope.enumProblemStates = enumProblemStates;
        $rootScope.enumFeatureStates = enumFeatureStates;

        // set up i18n bundle
        $rootScope.i18n = i18n;

        $http.get("/identify").success(function (user) {
            $rootScope.user = user;
        });

    });

function FormErrorHandler($scope) {
    return function(data, status, headers) {
        $scope.errors = [headers("X-Global-Error")];
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

function ProfileCtrl($scope, $rootScope, $http) {
    $rootScope.user.password = null;

    $scope.update = function(user) {
        var copy = angular.copy(user);
        $rootScope.user.password = null;
        $scope.confirmPassword = null;

        $http.put("/profile", copy)
            .success(function() {
                $scope.profileUpdated = true;
                setTimeout(function() {
                    $scope.$apply(function () {
                        $scope.profileUpdated = false;
                    });
                }, 2000);
            }).error(FormErrorHandler($scope));
    }
}

function DashboardCtrl($scope, $rootScope, $location) {
}