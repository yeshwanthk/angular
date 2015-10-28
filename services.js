'use strict';

/* Services */


var spotbuyServices = angular.module('spotbuyServices', []);

spotbuyServices.factory('CartedItem', function($http, $window) {
    var cartedItemAPI = {};
    cartedItemAPI.addToCart = function(request) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'addToCart',
        data: request
      });
    };

    return cartedItemAPI;
  });

spotbuyServices.factory('SearchService', function($http, $window) {
    var searchAPI = {};
    searchAPI.search = function(searchRequest) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'search',
        data: searchRequest
      });
    };

    return searchAPI;
  });

spotbuyServices.factory('SharedService', function($rootScope) {
    var sharedService = {};

    sharedService.refinementsChosen = null;
    sharedService.breadCrumbs = null;
    sharedService.categoriesChosen = null;

    sharedService.prepForBroadcast = function(refinements, bcs, categories) {
        this.refinementsChosen = refinements;
        this.breadCrumbs = bcs;
        this.categoriesChosen = categories;
        this.broadcastItem();
    };

    sharedService.broadcastItem = function() {
        $rootScope.$broadcast('handleBroadcast');
    };

    return sharedService;
});

spotbuyServices.factory('ItemDetails', function($http, $window) {

    var itemDetailsAPI = {};
    itemDetailsAPI.getItem = function(itemRequest) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'item',
        data: itemRequest
      });
    };

    return itemDetailsAPI;
  });




spotbuyServices.factory('ShippingService', function($http, $window) {

    var shippingAPI = {};
    shippingAPI.getShipping = function(shippingRequest) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'item/shipping',
        data: shippingRequest
      });
    };

    return shippingAPI;
  });

spotbuyServices.factory('SupplierProfile', function($http, $window) {

    var supplierProfileAPI = {};
    supplierProfileAPI.getSupplier = function(supplierId, token, realm, user, realmAnId) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'supplier',
        data: {'SupplierId':supplierId,
               'Location':'US',
               'SBSessionToken':token,
                'Realm': realm,
                'RealmAnId': realmAnId,
                'User': user
              }//?supplierId=' + supplierId
      });
    };

    return supplierProfileAPI;
  });


  spotbuyServices.factory('PropertiesService', function($http, $window) {

      var propertiesAPI = {};
      propertiesAPI.getProperties = function(propertyName) {
          return $http({
              method: 'GET',
              url: getRootUrl($window) + 'properties/' + propertyName
          });
      };
      return propertiesAPI;
  });

  spotbuyServices.factory('AccountService', function($http, $window, $rootScope) {

      var accountAPI = {};
      accountAPI.getAccountService = function() {
        return $http({
          method: 'POST',
          url: getRootUrl($window) + 'account/info',
          data: {'Realm':$rootScope.realm,
                 'User':$rootScope.user,
                 'RealmAnId':$rootScope.realmAnId,
                 'SBSessionToken':$rootScope.sbtoken
                }
        });
      };

      return accountAPI;
    });

    spotbuyServices.factory('RestrictionService', function($http, $window) {
        var restrictionAPI = {};
        restrictionAPI.importRestrictions = function(importRestrictionsRequest) {
          return $http({
            method: 'POST',
            url: getRootUrl($window) + 'restriction/import',
            data: importRestrictionsRequest
          });
        };

        restrictionAPI.exportRestrictions = function(exportRestrictionsRequest) {
          return $http({
            method: 'POST',
            url: getRootUrl($window) + 'restriction/export',
            data: exportRestrictionsRequest
          });
        };
        return restrictionAPI;
    });

    function getRootUrl ($window) {
        return $window.location.protocol+'//'+$window.location.host+'/Spotbuy/service/webresources/';
    }

/* Directive to display the start ratings for supplier profile */

spotbuyServices.directive('starRating', function () {
    return {
      restrict: 'A',            
      link: function (scope, elem, attrs) {
      $(elem).rateit({value: attrs.val, 
                      readonly: true, 
                      step: attrs.step, 
                      ispreset: true,
                      max: attrs.max});                          
        }
      };
    });


spotbuyServices.factory('OAuthTOUService', function($http, $window) {

    var touServiceAPI = {};
    touServiceAPI.acceptTOU = function(request) {
      return $http({
        method: 'POST',
        url: getRootUrl($window) + 'account/tou',
        data: request
      });
    };

    return touServiceAPI;
  });

spotbuyServices.factory('CommodityMappingService', function($http, $window) {
    var mappingServiceAPI = {};
    mappingServiceAPI.canViewMappings = function(request) {
        return $http({
            method: 'POST',
            url: getRootUrl($window) + 'mappings/view',
            data: request
        });
    };

    mappingServiceAPI.retrieveUnspscMappings = function(request) {
        return $http({
            method: 'POST',
            url: getRootUrl($window) + 'mappings/unspsc',
            data: request
        });
    };

    mappingServiceAPI.retrieveStoreMappings = function(request) {
        return $http({
            method: 'POST',
            url: getRootUrl($window) + 'mappings/store',
            data: request
        });
    };
    return mappingServiceAPI;
});
