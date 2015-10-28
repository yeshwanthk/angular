'use strict';

/* App module */

var spotbuyApp = angular.module('spotbuyApp', [
    'ui.bootstrap',
    'ngRoute',
    'ngSanitize',
    /*'spotbuyAnimation',*/
    'spotbuyControllers',
    'spotbuyServices',
    'spotbuyFilters'
]);


spotbuyApp.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/items', {
        templateUrl: 'html/searchresults.html',
        controller: 'SearchResultsController'
      }).
      when('/items/:itemId', {
              templateUrl: 'html/itemdetails.html',
              controller: 'ItemDetailsController'
      }).
      when('/setup', {
              templateUrl: 'html/admin.html',
              controller: 'SetupController'
      }).
      otherwise({
        redirectTo: '/items'
      });
  }]);

spotbuyApp.directive('truncatedstring', function () {
     return {
         restrict: 'AE',
             // declare the directive scope as private (and empty)
         scope: {fullstring: '=fullstring', maxlength: '=maxlength'},
             // add behaviour to our buttons and use a variable value
         templateUrl: 'html/components/truncatedString.html',

         link: function(scope) {
               if (scope.fullstring.length < scope.maxlength) {
                   scope.shortValue = scope.fullstring;
               }
               else {
                   scope.shortValue = scope.fullstring.substring(0, scope.maxlength) + " ... ";
               }
         }
     }
 });

 spotbuyApp.directive('ngEnter', function () {
      return function (scope, element, attrs) {
              element.bind("keydown keypress", function (event) {
                  if(event.which === 13) {
                      scope.$apply(function (){
                          scope.$eval(attrs.ngEnter);
                      });

                      event.preventDefault();
                  }
              });
          };
  });
