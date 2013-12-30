function ViewFeatureCtrl($scope, $http, $routeParams, $location, $route, $rootScope, featureService) {
    $scope.featureService = featureService;

    $scope.editFeature = function(feature) {
        $scope.selectedFeature = feature;
        $http.get('/features/' + feature.id)
            .success(function(featureWithTags) {
                // convert tag from simple raw values to select2-compatible object
                var rawTags = featureWithTags.tags;
                featureWithTags.tags = [];
                rawTags.map(function(tag) {featureWithTags.tags.push({id: tag, text: tag})});

                // map the team name over to the "text" attribute to make select2 happy
                if (featureWithTags.team) {
                    featureWithTags.team.text = featureWithTags.team.name;
                }

                $scope.selectedFeature = featureWithTags;
                $scope.showViewFeature = true;
                $scope.editFeatureForm.$setPristine(true);
                $rootScope.loading = false;

                featureService.update(featureWithTags);
            });
    };

    $scope.saveFeatureAndContinue = function(feature) {
        $scope.saveFeature(feature, function() {
            featureService.selectFeature(featureService.nextFeature);
        });
    };

    $scope.saveFeature = function(feature, callback) {
        // convert tags from select2 {id: ..., text: ...} format to just simple array of raw tag value
        var copy = angular.copy(feature);
        copy.tags = [];
        feature.tags.map(function(tag) {copy.tags.push(tag.id)});

        // remove the "text" field from the team that select2 adds so that it will be well-formed
        if (copy.team) {
            delete copy.team.text;
        }

        $scope.saving = true;

        $http.put('/features/' + feature.id, copy)
            .success(function(returnedFeature) {
                featureService.update(returnedFeature);

                $scope.saving = false;
                $scope.saved = true;
                $scope.editFeatureForm.$setPristine(true);
                if (callback) {
                    callback();
                }
                setTimeout(function() {
                    $scope.saved = false;
                    $scope.$digest();
                }, 5000);
            }).error(FormErrorHandler($scope));
    };

    // if we're given an ID then go ahead and get it, otherwise redirect back
    if (/^\-?\d*$/.test($routeParams.featureId)) {
        $rootScope.loading = true;
        $scope.editFeature({id: $routeParams.featureId});
    } else {
        $location.path("/features");
    }
}
