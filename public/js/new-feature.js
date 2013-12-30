function NewFeatureCtrl($scope, $http, $location, featureService) {
    $scope.createAnother = false;

    $scope.cmdEnter = function() {
        if ($scope.newFeatureForm.$pristine || $scope.newFeatureForm.$invalid) {
            return;
        }

        $scope.createFeature($scope.newFeature);
    };

    $scope.createFeature = function (feature) {
        // convert tags from select2 {id: ..., text: ...} format to just simple array of raw tag value
        var copy = angular.copy(feature);
        copy.tags = [];
        feature.tags.map(function(tag) {copy.tags.push(tag.id)});

        // remove the "text" field from the team that select2 adds so that it will be well-formed
        if (copy.team) {
            delete copy.team.text;
        }

        $scope.saving = true;
        $http.post('/features', copy)
            .success(function (returnedFeature) {
                $scope.saving = false;
                $scope.saved = returnedFeature.id;
                setTimeout(function() {
                    $scope.saved = null;
                    $scope.$digest();
                }, 5000);

                featureService.search();
                if ($scope.createAnother) {
                    $scope.newFeature = {tags: []};
                    $scope.junk = []; // todo: ugly hack to clear out tag selector
                    $scope.newFeatureForm.$setPristine(true);
                    $("#newFeatureFirstInput").focus(); // todo: we should focus back first field in a more Angular-like way, but I have no idea how!
                } else {
                    $location.path("/features");
                }
            }).error(FormErrorHandler($scope));
    };

    $scope.cancelNewFeature = function() {
        $location.path("/features");
    };
}
