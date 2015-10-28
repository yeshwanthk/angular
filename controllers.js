/* Controllers */

var spotbuyControllers = angular.module('spotbuyControllers', ['ui.bootstrap']);

function initParams ($window, $rootScope) {
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function(obj, start) {
            for (var i = (start || 0), j = this.length; i < j; i++) {
                if (this[i] === obj) {
                    return i;
                }
            }
            return -1;
        }
    }

    $rootScope.user = getQueryParam($window.location, "user");
    $rootScope.realm = getQueryParam($window.location, "realm");
    $rootScope.realmAnId = getQueryParam($window.location, "realmAnId");
    $rootScope.keyword = getQueryParam($window.location, "keyword");
    $rootScope.debug = getQueryParam($window.location, "debug");
    $rootScope.preferredCount = getQueryParam($window.location, "preferred");
    $rootScope.sessionId = getQueryParam($window.location, "sessionId");
    $rootScope.sbtoken = getQueryParam($window.location, "sbtoken");
    $rootScope.isInAPC = getQueryParam($window.location, "isInAPC");
    if (nullOrEmptyString($rootScope.zipCode)) {
        $rootScope.zipCode = getQueryParam($window.location.search, "zip");
    }
    if (nullOrEmptyString($rootScope.userCountry)) {
        $rootScope.userCountry = getQueryParam($window.location.search, "l");
    }
    if (nullOrEmptyString($rootScope.userCountry)) {
        $rootScope.userCountry = 'US';
    }

    if (nullOrEmptyString($rootScope.unspscCommodityCode)) {
        $rootScope.unspscCommodityCode = getQueryParam($window.location.search, "uncc");
    }
}


spotbuyControllers.controller('SearchResultsController', function ($q,$rootScope, $scope, SearchService, PropertiesService, SharedService, $modal, $window, $sce) {
    $('.zoomWindowContainer').remove();
    $('.zoomContainer').remove();

    $scope.breadcrumbs = ['Catalog Home'];
    $scope.categoriesChosen = [];

    $scope.bcCount = 0;
    $scope.isMultiRefinementChosen = function (breadCrumb) {
        $scope.bcCount = 0;
        if (!(breadCrumb.indexOf("Category: ") == 0)) {
            for (var key in $scope.refinementsChosen[breadCrumb].value) {
                if ($scope.refinementsChosen[breadCrumb].value.hasOwnProperty(key) &&
                    $scope.refinementsChosen[breadCrumb].value[key]) {
                    $scope.bcCount++;
                }
            }
        }
        else {
            $scope.bcCount = 1;
        }
        return $scope.bcCount;
    };

    $scope.getDecodedURIvalue = function (value) {
        return unescape(value);
    };

    $scope.getShippingMethod = function (item) {
        if (item.OneDayShippingAvailable == "true") {
            return "1 day ";
        }
        else if (item.ExpeditedShippingAvailable == "true") {
            return "Expedited ";
        }
        else if (item.FreeShippingAvailable == "true") {
            return "Free ";
        }
        return null;
    };

    $scope.getSingleRefinementValue = function (breadCrumb) {
        if (!(breadCrumb.indexOf("Category: ") == 0)) {
            for (var key in $scope.refinementsChosen[breadCrumb].value) {
                if ($scope.refinementsChosen[breadCrumb].value.hasOwnProperty(key) &&
                    $scope.refinementsChosen[breadCrumb].value[key]) {
                    return $scope.getDecodedURIvalue(key);
                }
            }
        } else {
            return breadCrumb.substr("Category: ".length);
        }

        return null;
    };

    $scope.getBreadCrumbValue = function (breadCrumb) {
        if (breadCrumb.indexOf("Category: ") == 0) {
            return "Category";
        }
        else {
            return $scope.getDecodedURIvalue(breadCrumb);
        }
    };

    $scope.clearallAction = function (breadCrumb, doSearch) {
        if (breadCrumb.indexOf("Category:") == 0) {
            $scope.categoriesChosen.pop();
        }
        else {
            var parentRefinements = $scope.refinementsChosen[breadCrumb].value;
            for (innerKey in parentRefinements) {
                if (parentRefinements.hasOwnProperty(innerKey)) {
                    delete parentRefinements[innerKey];
                }
            }
        }

        $scope.breadcrumbs.splice($scope.breadcrumbs.indexOf(breadCrumb), 1);

        if (doSearch) {
            // perform search with the updated refinements. This will update the search results page.
            $scope.search(null);

            // Perform a search in the background to update the aspects for the all the refinements chosen.
            // The search results will be used in the view all page of refinements.
            // @TODO do you think we need to clone refinementsChosen map instead of playing with it?
            $scope.asyncPromise = {};
            angular.forEach($scope.refinementsChosen, function (value, key) {
                if ($scope.refinementsChosen[key] && $scope.refinementsChosen[key].value) {
                    var aspectValue = $scope.refinementsChosen[key].value;
                    for (var innerKey in aspectValue) {
                        if (aspectValue.hasOwnProperty(innerKey) && aspectValue[innerKey]) {
                            var refinementExcluded = $scope.refinementsChosen[key];
                            delete $scope.refinementsChosen[key];
                            $scope.asyncSearch(key);
                            $scope.refinementsChosen[key] = refinementExcluded;
                            break;
                        }
                    }
                }
            });
        }
    }

    $scope.clearBreadCrumbs = function (index) {
        var i = 0;
        for (var i = $scope.breadcrumbs.length - 1; i > (index + 1); i--) {
            $scope.clearallAction ($scope.breadcrumbs[i], false);
        }
        if (i == (index + 1)) $scope.clearallAction ($scope.breadcrumbs[i], true);
    }

    $scope.refinementCount = 0;

    // Items to be displayed in the search results screen.
    $scope.items = [];
    $scope.itemsGrid = [];

    // boolean used to specify if the category refinements and search results refinements
    // is collapsed or not.
    $scope.isCollapsed = false;
    $scope.isCategoryCollapsed = false;

    // Total count of all items returned by the search
    $scope.totalCount = [];

    // search refinements returned by the search
    $scope.aspects = [];

    // Category refinements returned by the search
    $scope.categories = [];

    // Page number returned by the search. The maxValue will be based on the totalCount and itemsPerPage
    $scope.pageNumber = 1;
    $scope.totalPages;

    initParams($window, $rootScope);

    if ($rootScope.countryMap == null) {
        $scope.countryMap = getCountryMap($q).then(function (response) {
            $rootScope.countryMap = response.data.Countries;
            updateCountryMap();
        },function(error){
            console.log("could not get country map");
        });
    }
    else {
        updateCountryMap();
    }


    function getCountryMap ($q) {
        var deferred = $q.defer();
        deferred.promise = PropertiesService.getProperties("country");
        return deferred.promise;
    }

    function updateCountryMap () {
        $scope.countryMap = $rootScope.countryMap;
        $scope.selectedCountry = initSelectedCountry($rootScope, $scope.countryMap);
    }

    $scope.updateShippingLocation = function (selectedCountry, zipCode) {
        updateShippingLocation($rootScope, selectedCountry, zipCode);
        $scope.search(null);
    }
    // Create url action for when a user clicks on the Preferred tab to return to ssp
    $rootScope.returnUrl = $sce.trustAsResourceUrl(
        getSSPBaseUrl() +
        "ad/returnToPreferredTab/ariba.catalog.searchui.SpotBuyDirectAction?realm=" +
        $rootScope.realm);

    // Available options for how many items to display per page. The initial choice will be 20 items.
    $scope.viewOptions = [
        { id: 20, name: '20 Items' },
        { id: 50, name: '50 Items' },
        { id: 100, name: '100 Items' }
    ];

    $scope.sortOrders = [
        {id: "BestMatch" , name: 'Best Match'},
        {id: "PriceAscending" , name: 'Price - Lowest to Highest'},
        {id: "PriceDescending"  , name: 'Price - Highest to Lowest'},
        {id: "DistanceNearest"  , name: 'Distance - Nearest'}
    ];

    $scope.selectedViewOption = $scope.viewOptions[0];

    if ($rootScope.selectedSortOrder == null) {
        $rootScope.selectedSortOrder = $scope.sortOrders[0];
    }
    else {
        for (i=0; i<$scope.sortOrders.length; i++) {
            if ($rootScope.selectedSortOrder.id == $scope.sortOrders[i].id) {
                $rootScope.selectedSortOrder = $scope.sortOrders[i];
            }
        }
    }

    // Boolean used to specify whether to display the data in a list view or grid view
    $scope.useListView = true;

    // Boolean used to specify whether or not to switch to Preferred tab
    $scope.showPreferredTab = false;

    // Boolean used to specify whether to display the iframe responsible for resizing the height
    $scope.showResizeIframe = false;

    // The category refinement chosen. Only one category can be chosen at any time. Multi select is not
    // supported.
    $scope.categoryChosen = "";

    // The refinements chosen at any point in time. It is a map of refinement to the values chosen corresponding to
    // the same.
    $scope.refinementsChosen = {};

    $scope.asyncPromise = {};
    $scope.showHistogram = false;

    // The min and max price filters
    $scope.minPrice;
    $scope.maxPrice;

    var resetRefinementsDuringInitialSearch = true;
    $scope.getRequest = function() {
        return constructSearchRequestJson(
            $window.location.search,
            $scope.pageNumber,
            $scope.itemsPerPage,
            $scope.categoryChosen,
            $scope.refinementsChosen,
            $scope.showHistogram,
            $rootScope.selectedSortOrder.id,
            $scope.showSellerInfo,
            $rootScope.debug, $rootScope.zipCode, $rootScope.userCountry);
    };

   $scope.getSearchResults = function($q, itemsPerPage) {
        var deferred = $q.defer();
        $scope.showHistogram = false;
        $scope.itemsPerPage = itemsPerPage; //$scope.selectedViewOption.id;
        $scope.showResultsLoadingSpinner = true;
        $scope.showSellerInfo = true;
        deferred.promise = SearchService.search($scope.getRequest());
        return deferred.promise;
     }

    $scope.getHistogram = function ($q) {
        var deferred = $q.defer();
        $scope.showHistogram = true;
        $scope.itemsPerPage = 1;
        $scope.showHistogramLoadingSpinner = true;
        $scope.showSellerInfo = false;
        deferred.promise = SearchService.search($scope.getRequest());
        return deferred.promise;
    }

    // "see all" or "view all" will be shown only if the number of refinements is > 5.
    // It will also be shown, when the user has selected a refinement already and in case multi select
    // is required. User can multi select refinements in the view All refinements widget.
    $scope.showSeeMoreAspects = function (aspect) {
        if (aspect.ValueCount.length > 5) return true;

        var showViewAll = false;
        if($scope.refinementsChosen[aspect.Name] && $scope.refinementsChosen[aspect.Name].value) {
            for (var key in $scope.refinementsChosen[aspect.Name].value) {
                if ($scope.refinementsChosen[aspect.Name].value.hasOwnProperty(key) &&
                    $scope.refinementsChosen[aspect.Name].value[key]) {
                    showViewAll = true;
                    break;
                }
            }
        }
        return showViewAll;
    };


    // Search will be fired for each of the Chosen refinement types by excluding the same in the request
    // and having all the other chosen refinement types. The search by default asynchronous. The results of
    // this search will be used when the user clicks on "view all" or "see all" in the UI.
    $scope.asyncSearch = function (aspectName) {
        $scope.itemsPerPage = 1;
        $scope.pageNumber = 1;
        $scope.showHistogram = true;
        $scope.showSellerInfo = false;
        var promise = SearchService.search($scope.getRequest());
        $scope.asyncPromise[aspectName] = promise;
    };

    // API used to perform search as soon as a user clicks on a refinement.
    $scope.search = function (categoryId, categoryName) {
        $scope.showHistogramLoadingSpinner = true;
        $scope.showResultsLoadingSpinner = true;
        
        $scope.refinementCount = 0;
        if (categoryId) {
            $scope.categoryChosen = categoryId;
            if (categoryName) {
                $scope.categoriesChosen.push({'Name': categoryName, 'Id': categoryId});
                $scope.breadcrumbs.push("Category: " + categoryName);
            }
        }
        else {
            var categoryToSearchWith = $scope.categoriesChosen[$scope.categoriesChosen.length - 1];
            if (categoryToSearchWith && ($scope.categoryChosen != categoryToSearchWith['Id'])) {
                $scope.categoryChosen = categoryToSearchWith['Id'];
            } else if (!categoryToSearchWith) {
                $scope.categoryChosen = null;
            }
        }
        $scope.items = [];
        $scope.isCollapsed = false;
        $scope.isCategoryCollapsed = false;
        $scope.totalCount = [];
        $scope.aspects = [];
        $scope.categories = [];


        $scope.refinementHistogram = $scope.getHistogram($q).then(function(result){
             $scope.aspects = result.data.AspectHistogram;
             $scope.aspects = mergeChosenAspects ($scope.refinementsChosen, $scope.aspects);
             $scope.showHistogramLoadingSpinner = false;

              if ($scope.categoryChosen !="" && result.data.CategoryHistogram &&
                    result.data.CategoryHistogram.ChildCategoryHistogram) {
                         $scope.categories = result.data.CategoryHistogram.ChildCategoryHistogram;
              } else {
                  $scope.categories = result.data.CategoryHistogram;
                  for (var i = 0; i < $scope.categories.length; i++) {
                      if ($scope.categoryChosen && ($scope.categoryChosen == $scope.categories[i].CategoryId)) {
                          $scope.categories.splice(i, 1);
                          break;
                      }
                  }
              }
        },function(error){
            console.log("could not get histogram");
            $scope.showHistogramLoadingSpinner = false;

        });
        $scope.searchItemsAsync = $scope.getSearchResults($q, $scope.selectedViewOption.id).then(function (result) {
                $scope.searchError = null;
                if (result.data.StatusCode != 200) {
                    $scope.searchError = getError(result.data);
                    $scope.errorStyle = getErrorStyle($scope.searchError);
                    if ($scope.searchError.ErrorCode=="INVALID_ZIPCODE") {
                        if (!nullOrEmptyString($rootScope.zipCode)) {
                            $rootScope.zipCode = getQueryParam($window.location.search, "zip");
                        }
                    }
                }
                $scope.items = getArray(result.data.Items);
                if ($scope.items!=null) {
                    $scope.itemsGrid = splitArrayForGridView($scope.items);
                    $scope.totalCount = result.data.TotalItemCount;
                    $scope.totalPages = result.data.PaginationOutput.TotalPages;

                }else{
                     $scope.totalCount = 0;
                     $scope.totalPages = 0;
                }

                 // Ensure current page never surpasses total pages
                 if ($scope.pageNumber > $scope.totalPages) {
                     $scope.pageNumber = $scope.totalPages;
                 }
                $scope.showResizeIframe = true;
                $scope.showResultsLoadingSpinner = false;

             }, function(error){
             // @TODO Need to post this to the server to capture client side errors.
                     console.log("Error During Search, Request: " + $scope.getRequest());
                     $scope.UIErrorMessageSearch = "Error while getting search results";
                      $scope.showResultsLoadingSpinner = false;
             });
    };

    // API for updating the number of items displayed per page when a view option is selected
    $scope.updateItemsPerPage = function () {
        $scope.itemsPerPage = $scope.selectedViewOption.id;
        $scope.search(null);
    };

    // API for selecting to display the items in a list view layout
    $scope.showListView = function () {
        $scope.useListView = true;
    }

    // API for selecting to display the items in a grid view layout
    $scope.showGridView = function () {
        $scope.useListView = false;
        $scope.itemsGrid = splitArrayForGridView($scope.items);
    }

    // API for moving to the previous page and updating the results
    $scope.previousPage = function () {
        $scope.pageNumber--;
        $scope.search(null);
    }

    // API for moving to the next page and updating the results
    $scope.nextPage = function () {
        $scope.pageNumber++;
        $scope.search(null);
    }

    // API for checking if we are currently viewing the first page
    $scope.isFirstPage = function () {
        return $scope.pageNumber == 1;
    }

    // API for checking if we are currently viewing the last page
    $scope.isLastPage = function () {
        return $scope.pageNumber == $scope.totalPages;
    }

    // API for filtering results by price range
    $scope.filterByPrice = function () {
        var minPrice = document.getElementById("minPrice").value;
        var maxPrice = document.getElementById("maxPrice").value;
        if (maxPrice) {
            $scope.refinementsChosen["MaxPrice"]= {"value":{},"excludeMerge":true};
            $scope.refinementsChosen["MaxPrice"].value[maxPrice]= true;
        } else {
            $scope.refinementsChosen["MaxPrice"] = {value: {}};
        }

        if (minPrice) {
            $scope.refinementsChosen["MinPrice"] = {"value":{},"excludeMerge":true}; // = {"value":{10:true}};
            $scope.refinementsChosen["MinPrice"].value[minPrice]= true; // = {"value":{10:true}};
        } else {
             $scope.refinementsChosen["MinPrice"] = {value: {}};
        }

        $scope.search(null);

    }

    $scope.searchForRefinementChosen = function(aspectName, value, refinementValue) {
        // Update the Bread Crumb
        if (aspectName != null) {
            var foundBC = false;
            for (var i = 0; i < $scope.breadcrumbs.length; i++) {
                var bc = $scope.breadcrumbs[i];
                if (bc == aspectName) {
                    foundBC = true;
                    var allUnmarked = true;
                    for (var key in $scope.refinementsChosen[bc].value) {
                        if ($scope.refinementsChosen[bc].value.hasOwnProperty(key) &&
                            $scope.refinementsChosen[bc].value[key]) {
                            allUnmarked = false;
                            break;
                        }
                    }
                    if (allUnmarked) {
                        $scope.breadcrumbs.splice($scope.breadcrumbs.indexOf(bc), 1);
                    }
                    break;
                }
            }
            ;
            if (!foundBC) {
                $scope.breadcrumbs.push(aspectName);
            }
        }

        // perform search with the updated refinements. This will update the search results page.
        $scope.search(null);

        // Perform a search in the background to update the aspects for the all the refinements chosen.
        // The search results will be used in the view all page of refinements.
        // @TODO do you think we need to clone refinementsChosen map instead of playing with it?
        $scope.asyncPromise = {};
        angular.forEach($scope.refinementsChosen, function (value, key) {
            if($scope.refinementsChosen[key] && $scope.refinementsChosen[key].value) {
                var aspectValue = $scope.refinementsChosen[key].value;
                for (var innerKey in aspectValue) {
                    if (aspectValue.hasOwnProperty(innerKey) && aspectValue[innerKey]) {
                        var refinementExcluded = $scope.refinementsChosen[key];
                        delete $scope.refinementsChosen[key];
                        $scope.asyncSearch(key);
                        $scope.refinementsChosen[key] = refinementExcluded;
                        break;
                    }
                }
            }
        });
    };

    if (SharedService.refinementsChosen == null) {
        $scope.Histogram = $scope.getHistogram($q).then(function (result) {
            $scope.categories = result.data.CategoryHistogram;
            $scope.aspects = result.data.AspectHistogram;
            $scope.showHistogramLoadingSpinner = false;

            angular.forEach($scope.aspects, function (aspect) {
                $scope.refinementsChosen[aspect.Name] = {value: {}};
            });

        }, function (error) {
            console.log("could not get histogram");
             $scope.showHistogramLoadingSpinner = false;
        });


        // Construct the Json Request based out of the params sent via the URL request, followed by a search.

        $scope.searchItemsAsync = $scope.getSearchResults($q, $scope.selectedViewOption.id).then(function (result) {
                $scope.items = getArray(result.data.Items);
                if ($scope.items!=null) {
                    $scope.itemsGrid = splitArrayForGridView($scope.items);
                    $scope.totalCount = result.data.TotalItemCount;
                    $scope.totalPages = result.data.PaginationOutput.TotalPages;
                } else{
                    $scope.totalCount = 0;
                    $scope.totalPages = 0;
                }

                $scope.showResizeIframe = true;
                $scope.showResultsLoadingSpinner = false;
            }
            , function (error) {
                // @TODO Need to post this to the server to capture client side errors.
                console.log("Error During Search, Request: " + $scope.getRequest());
                $scope.UIErrorMessageSearch = "Error while getting search results";
                $scope.showResultsLoadingSpinner = false;
            });
    }
    else {
        $scope.refinementsChosen = SharedService.refinementsChosen;
        $scope.breadcrumbs = SharedService.breadCrumbs;
        $scope.categoriesChosen = SharedService.categoriesChosen;
        SharedService.prepForBroadcast(null, null, null);
        $scope.searchForRefinementChosen(null);
    }

    // API for switching back to the Preferred tab by enabling a hidden iframe with a redirect url
    $scope.switchToPreferred = function () {
        $scope.showPreferredTab = true;
        $scope.showResizeIframe = false;
    }

    // API for obtaining a url to resize the spotbuy iframe based  on the current height of the page
    $scope.resizeSearchResultsIframeUrl = function () {
        setIframeResizeUrl($rootScope.realm, $window.document.body.offsetHeight, 'MarketplaceFrame', $sce);
    }

}).directive('refinementPopover', function ($compile,$templateCache) {

    var getTemplate = function (contentType) {
        var template = '';
        switch (contentType) {
            case 'categories':
                template = $templateCache.get("allCategories.html");
                break;
            case 'refinements':
                template = $templateCache.get("allRefienments.html");
                break;
            case 'popoverTemplate':
                template = $templateCache.get("popoverTemplate.html");
                break;
        }
        return template;
    }
    return {
        restrict: "A",
        link: function (scope, element, attrs) {

            var popOverContent;
            var titleValue = "";
            var titleDisplayValue = "";

            // this stores the refinements chosen within the popover. This will get synched with the
            // global list when the user clicks on "OK"
            scope.aspectsChosen = {value : {}};

            // popoverContent uses 2 different popovers. 1. to render categories viewAll 2. render refinements ViewAll
            if (scope.aspect) {
                popOverContent = getTemplate("refinements");
                titleValue = scope.aspect.Name;
                titleDisplayValue = scope.aspect.DisplayName;
            }
            else {
                popOverContent = getTemplate("categories");
            }

            // Popover temeplate will be used as a markup to show the popover contents
            var popOverTemplate = getTemplate("popoverTemplate");

            var options = null;
            if (!scope.aspect) {
                options = {
                    title: "Categories",
                    placement: "right",
                    html: true,
                    template: $compile(popOverTemplate)(scope),
                    trigger: 'click',
                    content: $compile(popOverContent)(scope)
                };
            }
            else {
                options = {
                    title: titleDisplayValue,
                    placement: "right",
                    html: true,
                    template: $compile(popOverTemplate)(scope),
                    trigger: 'click',
                    content: function () {
                        // Dynamic content. Remove the previous content first and then update the new content
                        var popover = $(this).data('bs.popover');
                        popover.options.content = null;

                        angular.forEach(scope.refinementsChosen, function (value, key) {
                            if (key == titleValue) {
                                for (innerKey in scope.refinementsChosen[key].value) {
                                    scope.aspectsChosen.value[innerKey] = scope.refinementsChosen[key].value[innerKey];
                                }
                            }
                        });

                        if (scope.asyncPromise && scope.asyncPromise[scope.aspect.Name]) {
                            scope.asyncPromise[scope.aspect.Name].then(
                                function (response) {
                                    var viewAllAspects = response.data.AspectHistogram;
                                    viewAllAspects = mergeChosenAspects(scope.refinementsChosen, viewAllAspects);
                                    for (var i = 0; i < viewAllAspects.length; i++) {
                                        if (viewAllAspects[i].Name == scope.aspect.Name) {
                                            scope.aspect = viewAllAspects[i];
                                            break;
                                        }
                                    }
                                },
                                function (response) {
                                    // @TODO Need to post this to the server to capture client side errors.
                                    console.log("Error During Async Refinement Search, Aspect Name: " + $scope.aspect.Name);
                                });
                        }
                        return $compile(popOverContent)(scope);
                    }
                };
            }

            $('[data-toggle="seeAll"]').popover(options);

            $('body').on('click', function (e) {
                $('[data-toggle="seeAll"]').each(function () {
                    //the 'is' for buttons that trigger popups
                    //the 'has' for icons within a button that triggers a popup
                    if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                        $(this).popover('hide');
                    }
                });
            });

            scope.ok = function() {
                var doSearch = false;
                var popoverAspectsChosenCount = 0;
                // Search with the refinements chosen within the popover
                if (scope.aspectsChosen && scope.aspectsChosen.value) {
                    var parentRefinements = scope.refinementsChosen[scope.aspect.Name].value;
                    for (innerKey in scope.aspectsChosen.value) {
                        popoverAspectsChosenCount++;
                        if (parentRefinements[innerKey] && parentRefinements[innerKey] != scope.aspectsChosen.value[innerKey]) {
                            parentRefinements[innerKey] = scope.aspectsChosen.value[innerKey];
                            doSearch = true;
                        }
                        else if (!parentRefinements[innerKey]) {
                            parentRefinements[innerKey] = scope.aspectsChosen.value[innerKey];
                            doSearch = true;
                        }
                    }

                    if (popoverAspectsChosenCount == 0) {
                        for (innerKey in parentRefinements) {
                            if (parentRefinements.hasOwnProperty(innerKey)) {
                                delete parentRefinements[innerKey];
                                doSearch = true;
                            }
                        }
                    }

                    // Update the Bread Crumb
                    if (doSearch) {
                        var foundBC = false;
                        for (var i = 0; i < scope.breadcrumbs.length; i++) {
                            var bc = scope.breadcrumbs[i];
                            if (bc == scope.aspect.Name) {
                                foundBC = true;
                                var allUnmarked = true;
                                for (var key in scope.refinementsChosen[bc].value) {
                                    if (scope.refinementsChosen[bc].value.hasOwnProperty(key) &&
                                        scope.refinementsChosen[bc].value[key]) {
                                        allUnmarked = false;
                                        break;
                                    }
                                }
                                if (allUnmarked) {
                                    scope.breadcrumbs.splice(scope.breadcrumbs.indexOf(bc), 1);
                                }
                                break;
                            }
                        };

                        if (!foundBC) {
                            scope.breadcrumbs.push(scope.aspect.Name);
                        }
                    }
                }

                if (!doSearch) {
                    // Do Nothing. No Aspects chosen/unselected
                    $('[data-toggle="seeAll"]').popover('hide');
                }
                else {
                    // perform search with the updated refinements. This will update the search results page.
                    scope.search(null);

                    // Perform a search in the background to update the aspects for the all the refinements chosen.
                    // The search results will be use din the view all page of refinements.
                    // @TODO do you think we need to clone refinementsChosen map instead of playing with it?
                    scope.asyncPromise = {};
                    angular.forEach(scope.refinementsChosen, function (value, key) {
                        if (scope.refinementsChosen[key] && scope.refinementsChosen[key].value) {
                            var aspectValue = scope.refinementsChosen[key].value;
                            for (var innerKey in aspectValue) {
                                if (aspectValue.hasOwnProperty(innerKey) && aspectValue[innerKey]) {
                                    var refinementExcluded = scope.refinementsChosen[key];
                                    delete scope.refinementsChosen[key];
                                    scope.asyncSearch(key);
                                    scope.refinementsChosen[key] = refinementExcluded;
                                    break;
                                }
                            }
                        }
                    });
                }
            };

            scope.clearall = function() {
                scope.aspectsChosen = {value : {}};
            };

            scope.showCancel = function() {
                return !scope.aspect;
            };

            scope.cancel = function() {
                $('[data-toggle="seeAll"]').popover('hide');
            };

        }
    };
});

spotbuyControllers.controller('ItemDetailsController', function ($q, $rootScope, $scope, $window, $routeParams, $sce, ItemDetails, ShippingService, SharedService, CartedItem) {
    $scope.showItemLoadingSpinner = true;
    initParams($window, $rootScope);
   $scope.asyncCartedItemUpdate = function ($q, request) {
            var deferred = $q.defer();
            deferred.promise = CartedItem.addToCart(request);
            return deferred.promise;
    }

   $scope.updateCartedItem = function (selectedVariationId) {
        if (selectedVariationId!=null) {
            var selectedVariation = {};
            selectedVariation["VariationID"] = selectedVariationId;
            $scope.item.SelectedVariation = selectedVariation;

        }
        var cartedItemUpdateRequest = constructCartedItemUpdate($scope.item, $scope.storeInfo,
                                            $rootScope.realm, $rootScope.realmAnId, $rootScope.sbtoken, $rootScope.user,
                                            $rootScope.isInAPC);
        cartedItemUpdateRequest = cartedItemUpdateRequest.replace("\\\"","\"");

        $scope.asyncCartItemUpdate = $scope.asyncCartedItemUpdate($q, cartedItemUpdateRequest).then(function (result) {
            //everything successful. nothing to do
            console.log("AddtoCart To spotbuy successful");
        }, function(error) {
            //did not happen. it is ok. we will simply continue
            console.log("ERROR!!!!!!AddtoCart To spotbuy successful");
        });
    }
    if (SharedService.refinementsChosen && !$scope.refinementsChosen) {
        $scope.refinementsChosen = SharedService.refinementsChosen;
        $scope.breadcrumbs = SharedService.breadCrumbs;
        $scope.categoriesChosen = SharedService.categoriesChosen;
    }

    $scope.addToCart = function() {
        $scope.submit = true;
        if (!validateItem()) {
            return;
        }
        var iFrame = document.getElementById("BuyerAddToCartDirectActionIFrame");
        if(iFrame) {
            var result = $scope.updateCartedItem($scope.variationId);
            var item = $scope.addToCartJson().replace("#"," ");
            var url = $sce.trustAsResourceUrl(getSSPBaseUrl() + 
                "ad/addToCart/ariba.catalog.searchui.SpotBuyDirectAction?" +
                "item=" + encodeURIComponent(item) + "&sessionId=" +  $rootScope.sessionId +
                "&realm=" + $rootScope.realm + "&isInAPC=" + $rootScope.isInAPC);
            iFrame.src = url;
        }

    };

    var el = document.getElementById('top');
    if (el != null) {
       el.scrollIntoView();
    }
    else {
        window.scrollTo(0,0);
    }

    $scope.submit = false;
    $scope.getRequest = function() {
        var userName = $routeParams.user;
        //If request is from preferred tab to itemDetails then fetch the user, realm and sessionId
        if (userName) {
            $rootScope.user = $routeParams.user;
            $rootScope.realm = $routeParams.realm;        
            $rootScope.sessionId = $routeParams.sessionId;
            $rootScope.isInAPC = $routeParams.isInAPC;
        }        
        return constructItemDetailsRequestJson(
            $rootScope.user, $rootScope.realm, $rootScope.realmAnId, $routeParams.itemId, $rootScope.sbtoken);
    };
    $scope.item = ItemDetails.getItem($scope.getRequest()).success(function (response) {
        $scope.imageBackgroundSize = $(window).width()*0.25;
        if ($scope.imageBackgroundSize < 320) {
            $scope.imageBackgroundSize = 320;
        }

        $scope.imgBackgroundStyle = {
              height : $scope.imageBackgroundSize+'px',
              width : $scope.imageBackgroundSize+'px'
        };

        $scope.imgBackgroundWidth = {
              width : $scope.imageBackgroundSize+'px'
        };

        if (response.Item!=null) {
            $scope.invalidToken = false;
            if (response.StatusCode != 200) {
                $scope.itemError = getError(response);
                if ($scope.itemError.ErrorCode=="INVALID_IAF_TOKEN") {
                    $scope.invalidToken = true;
                    $scope.invalidTokenMsg = $scope.itemError.Message;
                }
            }

            $scope.storeInfo = response.SupplierInfo;
            $scope.item = response.Item;
            $scope.spotbuySupplierANID = response.SpotbuySupplierANID;
            $scope.isTopRatedPlusSupplier = response.Item.Supplier.IsTopRatedPlusSeller;
            $scope.price = response.Item.Price;
            $scope.retailPrice = response.Item.OriginalRetailPrice;
            $scope.quantitySold = response.Item.QuantitySold;
            $scope.quantityAvailable = response.Item.Quantity - response.Item.QuantitySold;
            if (response.Item.ItemSpecs != null) {
                $scope.specs = getArray(response.Item.ItemSpecs.NameValueList);
            }
            $scope.varValues = [];
            $scope.picSets = getArray(response.Item.PictureSets);
            picMap = {};
            for (var i in $scope.picSets) {
                picMap[$scope.picSets[i].SmallImageUrl] = $scope.picSets[i].LargeImageUrl;
            }
            if ($scope.picSets != null) {
                $scope.setImage($scope.picSets[0].SmallImageUrl);
            }

            var variations = response.Item.Variations;
            var varKeys = [];
            if (variations != null) {
                $scope.variations = getArray(variations.VariationSpecificsSet.NameValueList);
                $scope.variationValues = [];
                for (var i=0; i<$scope.variations.length; i++) {
                    $scope.variationValues[i] = null;
                    varKeys[i] = $scope.variations[i].Name;
                }

                $scope.pictureMap = {};
                var pictures = getArray(variations.Pictures);
                if (pictures != null) {
                    for (var i=0; i<pictures.length; i++) {
                        var name = pictures[i].VariationSpecificName;
                        var picturesSet = getArray(pictures[i].VariationSpecificPictureSet);
                        for (var j=0; j<picturesSet.length; j++) {
                            var value = picturesSet[j].VariationSpecificValue;
                            var picUrl = getArray(picturesSet[j].PictureURL);
                            if (picUrl != null) {
                                $scope.pictureMap[name, value] = picUrl[0];
                            }
                        }
                    }
                }

                $scope.variationsMap = {};
                var variationArray = getArray(variations.Variation);
                for (var i=0; i<variationArray.length; i++) {
                    var variation = variationArray[i];
                    var varQtySold = variation.QuantitySold;
                    var varQtyAvail = variation.Quantity - variation.QuantitySold;
                    var varPrice = variation.Price;
                    var varRetailPrice = variation.OriginalRetailPrice;
                    var varList = getArray(variation.VariationSpecifics.NameValueList);
                    var varNameKey = [];
                    for (var j=0; j<varList.length; j++) {
                        var keyIndex = varKeys.indexOf(varList[j].Name);
                        varNameKey[keyIndex] = varList[j].Value;
                    }
                    $scope.variationsMap[varNameKey] = [varPrice, varRetailPrice, varQtyAvail, varQtySold];
                }

                $scope.variationIDs = $scope.getVariationIDs($q).then(function(response ){
                    console.log("inside getVariationIDs then");
                    if (response.data.Item!=null) {
                      var vars = response.data.Item.Variations;
                      var varArray = getArray(vars.Variation);
                      for (var i=0; i<varArray.length; i++) {
                          var variation =  varArray[i];
                          var varList = getArray(variation.VariationSpecifics.NameValueList);
                          var varNameKey = [];
                          for (var j=0; j<varList.length; j++) {
                              var keyIndex = varKeys.indexOf(varList[j].Name);
                              varNameKey[keyIndex] = varList[j].Value;
                          }
                          $scope.variationsMap[varNameKey][4] = variation.VariationID;
                      }
                    }
                },function(error){
                    console.log("could not get variation ids");
                });
            }

            $scope.showImageArray = $scope.picSets.length > 1;
            $scope.returnPolicy = response.Item.ReturnPolicy;
            $scope.showResizeIframe = true;

            $scope.countryMap = getArray(response.Item.ShippingDetails.Countries);
            $scope.selectedCountry = initSelectedCountry($rootScope, $scope.countryMap);

            $scope.desc = $scope.getDescription($q).then(function(response ){
                console.log("inside get desc then");
                if (response.data.Item!=null) {
                   $scope.description = response.data.Item.ItemDesc;
                }
            },function(error){
                console.log("could not get shipping details");
            });

            $scope.shippingDetails = $scope.getShippingDetails($q).then(function(response ){
                console.log("inside getShippingDetails then");
                updateShippingDetails(response.data);
            },function(error){
                console.log("could not get shipping details");
            });

            $scope.showFullDesc = false;
            $scope.itemTextDesc = $scope.item.ItemDesc;
            if ($scope.itemTextDesc.length > 500) {
                var index = $scope.itemTextDesc.indexOf(" ", 500);
                if (index < $scope.itemTextDesc.length-1) {
                    $scope.showFullDesc = true;
                }
                $scope.itemTextDesc = $scope.itemTextDesc.substring(0, index);
            }
        } else {
            $scope.UIErrorMessage = "Cannot fetch item details. Try again later";
        }
        $scope.showItemLoadingSpinner = false;
    }).error(function (response) {
        console.log("Error!!!");
        $scope.UIErrorMessage = "Cannot fetch item details. Try again later";
        $scope.showItemLoadingSpinner = false;
    });

    function validateItem () {
        if ($scope.selectedQuantity < 1 || $scope.selectedQuantity > $scope.quantityAvailable) {
            return false;
        }
        if ($scope.variations) {
            var numberOfVars = $scope.variations.length;
            for (var i = 0; i < numberOfVars; i++) {
                if ($scope.varValues[i] == null) {
                    return false;
                }
            }
        }
        return true;
    }

    $scope.canAddToCart = function () {
        if ($scope.invalidToken) {
            return false;
        }
        if ($scope.item.Allowed == "false") {
            return false;
        }
        if (!validateItem()) {
            return false;
        }
        return true;
    }

    $scope.getShippingDetails = function ($q) {
        var deferred = $q.defer();
        deferred.promise = ShippingService.getShipping(getShippingRequest());
        return deferred.promise;
    }

    function getShippingRequest () {
        return constructShippingRequestJson($routeParams.itemId, $rootScope.userCountry, $rootScope.zipCode, $rootScope.sbtoken,
        $rootScope.user, $rootScope.realm, $rootScope.realmAnId);
    }

    $scope.updateShipping = function () {
        $scope.shippingDetails = ShippingService.getShipping(getShippingRequest()).success(function(response ){
            console.log("inside getShippingDetails success");
            updateShippingDetails(response);

        }).error(function (response) {
            console.log("Error update shipping cost!!!");
        });
    }

    $scope.updateShippingLocation = function (selectedCountry, zipCode) {
        updateShippingLocation($rootScope, selectedCountry, zipCode);
        $scope.updateShipping();
    }

    function updateShippingDetails (shippingResponse) {
        $scope.shippingError = null;
        if (shippingResponse.StatusCode != 200) {
            $scope.shippingError = getError(shippingResponse);
            $scope.errorStyle = getErrorStyle($scope.shippingError);
        }
        var shippingDetails = shippingResponse.ShippingDetails;
        if (shippingDetails!=null) {
              $scope.localShipping = null;
              $scope.globalShipping = null;
              var shippingServices = shippingDetails.ShippingServiceOptions;
              if (shippingServices != null) {
                  $scope.localShipping = getArray(shippingServices);
              }
              var globalShippingServices = shippingDetails.InternationalShippingServiceOptions;
              if (globalShippingServices != null) {
                  $scope.globalShipping = getArray(globalShippingServices);
              }
              var taxInfo = shippingDetails.Taxes;
              if (taxInfo != null) {
                  $scope.taxes = getArray(taxInfo);
              }
              $scope.earliestDeliveryTimeFrom = shippingDetails.EarliestDeliveryTimeFrom;
              $scope.earliestDeliveryTimeTo = shippingDetails.EarliestDeliveryTimeTo;
        }
    }

    $scope.getVariationIDs = function ($q) {
        var deferred = $q.defer();
        var request = constructItemVariationIDRequestJson($rootScope.user, $rootScope.realm, $rootScope.realmAnId, $routeParams.itemId, $rootScope.sbtoken);
        deferred.promise = ItemDetails.getItem(request);
        return deferred.promise;
    }

    $scope.getDescription = function ($q) {
        var deferred = $q.defer();
        var request = constructItemDescriptionRequestJson($rootScope.user, $rootScope.realm, $routeParams.itemId,
                        $rootScope.sbtoken, $rootScope.realmAnId);
        deferred.promise = ItemDetails.getItem(request);
        return deferred.promise;
    }



    $scope.setVariation = function(key, name, value) {
        if ($scope.pictureMap[name, value] != null) {
            $scope.setImage($scope.pictureMap[name, value]);
        }
        $scope.varValues[key] = value;
        var values = $scope.variationsMap[$scope.varValues];
        if (values != null) {
            if (values[0] != null) {
                $scope.price = values[0];
            }
            if (values[1] != null) {
                $scope.retailPrice = values[1];
            }
            if (values[2] != null) {
                $scope.quantityAvailable = values[2];
            }
            if (values[3] != null) {
                $scope.quantitySold = values[3];
            }
            if (values[4] != null) {
                $scope.variationId = values[4];
                $scope.item.SelectedVariation.VariationID = values[4];
            }
        }
        else {
            $scope.item.SelectedVariation.VariationID =null;
            // This variation combination doesn't exist
            var allVarChosen = true;
            var numberOfVars = $scope.variations.length;
            for (var i=0; i<numberOfVars; i++) {
                if ($scope.varValues[i] == null) {
                    allVarChosen = false;
                }
            }
            if (allVarChosen) {
                $scope.quantityAvailable = 0;
                $scope.quantitySold = 0;
            }
        }
    }

    $scope.getVariationValues = function (variationValues) {
        return getArray(variationValues);
    }

    $scope.getStringValue = function(list) {
        if (list == null) {
            return "";
        }
        else if (list instanceof Array) {
            var string = "";
            for (var i in list) {
                string = string + list[i];
                if (i < list.length-1) {
                    string = string + ", ";
                }
            }
            return string;
        }
        else {
            return list;
        }
    }

    $scope.getMainImage = function () {
        return $scope.tmpImageUrl == null ? $scope.mainImageUrl : $scope.tmpImageUrl;
    }

    $scope.setTmpImage = function(imageUrl) {
        $scope.tmpImageUrl = imageUrl;
        var image = new Image();
        image.src = $scope.tmpImageUrl;
        getImageSize(image);
    }

    $scope.resetTmpImage = function(imageUrl) {
        $scope.tmpImageUrl = null;
        var image = new Image();
        image.src = $scope.mainImageUrl;
        getImageSize(image);
    }

    $scope.setImage = function(imageUrl) {
      $scope.mainImageUrl = imageUrl;
      var image = new Image();
      image.src = $scope.mainImageUrl;
      getImageSize(image);
      image.onload = function () {
        $scope.$apply(function() {
          getImageSize(image);
        });
      }
      $scope.largeImageUrl = picMap[image.src];
    }

    function getImageSize (image) {
        var imageSize = $scope.imageBackgroundSize - 40;
        if (image.height > imageSize) {
            mainImageHeight = imageSize;
        } else {
            mainImageHeight = image.height;
        }
        if (image.width > imageSize) {
            mainImageWidth = imageSize;
        } else {
            mainImageWidth = image.width;
        }

        $scope.mainImageStyle = {
              height : mainImageHeight+'px',
              width : mainImageWidth+'px'
        };

    }

    $scope.setLargeImage = function(imageUrl) {
        $('.zoomWindow').css('background-image', "url("+imageUrl+")");
    }





    $scope.addToCartJson = function ()
    {
        var cartItem = {};
        cartItem["ItemName"] = $scope.item.ItemName;

        cartItem["Thumbnail"] = $scope.item.GalleryURL;
        cartItem['StoreImageURL'] = $scope.storeInfo.StoreImageURL;

        var supplier = {};
        supplier["SupplierId"] = $scope.item.Supplier.SupplierId;
        supplier["SupplierName"] = $scope.item.Supplier.SupplierDisplayName;
        supplier["SpotBuySupplierANId"] = $scope.spotbuySupplierANID;
        if ($scope.storeInfo != null) {
            supplier["StoreANId"] = $scope.storeInfo.SupplierANID;
            supplier["Store"] = $scope.storeInfo.Store;
        }
        supplier["TopRated"] = $scope.item.Supplier.IsTopRatedSeller;
        supplier["PositivePercent"] = $scope.item.Supplier.TotalPositiveFeedbackPercent;
        supplier["TotalScore"] = $scope.item.Supplier.TotalFeedbackScore;
        cartItem["Supplier"] = supplier;

        var price = {};
        price["Value"] = $scope.price.Value;
        price["Currency"] = $scope.price.Currency;
        cartItem["Price"] = price;
        cartItem["Quantity"] = $scope.selectedQuantity;
        cartItem["LeadTime"] = $scope.item.LeadTime;

        if ($scope.item.Classification != null && $scope.item.Classification.UNSPSC!=null) {
            var category = {};
            category["Domain"] = "UNSPSC";
            category["Value"] = $scope.item.Classification.UNSPSC;
            category["StoreCategoryID"] = $scope.item.Classification.StoreCategoryID;
            cartItem["Category"] = category;
        }
        cartItem["ItemId"] = $scope.item.ItemId;

        if ($scope.item.SelectedVariation!=null && $scope.item.SelectedVariation.VariationID!=null) {
            if ($rootScope.isInAPC=="true") {
               cartItem["ItemId"] = $scope.item.ItemId+"-"+$scope.item.SelectedVariation.VariationID;
            }
        }
        $scope.variationId = null;
        if ($scope.variationsMap != null && $scope.varValues != null) {
            var values = $scope.variationsMap[$scope.varValues];
            if (values != null) {
                var selectedVar = {};
                cartItem["VariationId"] = values[4];
                $scope.variationId = values[4];

                for (var i = 0; i < $scope.variations.length; i++) {
                    var varName = $scope.variations[i].Name;
                    selectedVar[varName] = $scope.varValues[i];
                }
                cartItem["Variation"] = selectedVar;
                cartItem["Thumbnail"] = $scope.getMainImage();
            }
        }

        cartItem["ApprovalRequired"] =  $scope.item.RequiresApproval;
        cartItem["CustomMessage"] = $scope.item.CustomMessage;
        cartItem["Allowed"] = $scope.item.Allowed;

        // console.debug(angular.toJson(cartItem));

        return angular.toJson({"Item": cartItem});
    }

    $scope.showResizeIframe = false;

    // API for obtaining a url to resize the spotbuy iframe based  on the current height of the page
    $scope.resizeItemDetailsIframeUrl = function () {
        setIframeResizeUrl($rootScope.realm, $window.document.body.offsetHeight, 'MarketplaceFrame', $sce);
    }

    $scope.tabs = [
    	    { title:"Item Description", content:"html/description.html", active:true, id:"description" },
    	    { title:"Specification", content:"html/specs.html", id:"specs" },
    	    { title:"Shipping & Delivery", content:"html/shipping.html", id:"shipping" },
    	    { title:"Return Policy", content:"html/return.html", id:"return" }
    	  ];
}).directive('ngElevateZoom', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        //Will watch for changes on the attribute
        attrs.$observe('zoomImage',function(){
          linkElevateZoom();
        })

        function linkElevateZoom(){
          //Check if its not empty
          if (!attrs.zoomImage) return;
          $(element).removeData('elevateZoom');
          $('.zoomContainer').remove();
          var height = $(window).height()-50;
          var width = $(window).width() - scope.imageBackgroundSize-20;
          if (height > 800) {
            height = 800;
          }
          if (width > 800) {
            width = 800;
          }
          element.attr('data-zoom-image',attrs.zoomImage);
          console.log(element.attr('zoom-image'));
          console.log("zoom window width: " + width + " height : " + height);
          $(element).elevateZoom({zoomWindowPosition: "zoom-container",
                                  responsive: true,
                                  zoomWindowHeight: height, zoomWindowWidth: width,
                                  borderSize: 0, scrollZoom : true});

        }

        linkElevateZoom();
      }
    };
  }).directive("scrollTo", ["$window", function($window){
          return {
            restrict : "AC",
            compile : function(){

              var document = $window.document;

                function scrollInto(idOrName) {//find element with the give id of name and scroll to the first element it finds
                  if(!idOrName)
                    idOrName='top';
                  //check if an element can be found with id attribute
                  var el = document.getElementById(idOrName);
                  if(el == null) {//check if an element can be found with name attribute if there is no such id
                    el = document.getElementsByName(idOrName);

                    if(el && el.length)
                      el = el[0];
                    else
                      el = null;
                  }

                  if(el != null) //if an element is found, scroll to the element
                    el.scrollIntoView();
                  //otherwise, ignore
                }
              return function(scope, element, attr) {
                element.bind("click", function(event){
                  scrollInto(attr.scrollTo);
                });
              };
            }
          };
      }]);


spotbuyControllers.controller('SupplierProfileController',function($rootScope, $scope, $modal, SupplierProfile) {
    $scope.viewSupplierData = function (supplierId) {
        SupplierProfile.getSupplier(supplierId, $rootScope.sbtoken, $rootScope.realm, $rootScope.user,
                $rootScope.realmAnId).success(function (response) {
        $scope.supplierProfile = response;                
        var modalInstance = $modal.open({
            templateUrl: 'html/supplierprofile.html',
            controller: 'ModalSupplierDetailsController',
            windowClass: 'app-modal-window',
            resolve: {
                supplierProfile: function () {
                    return $scope.supplierProfile;
                }
            }
        });
        }).error(function (response) {
            console.log("Error!!!");
        });               
    };    
});

spotbuyControllers.controller('ModalSupplierDetailsController',function($scope, $modalInstance, supplierProfile) {
    $scope.supplierProfile = supplierProfile;
    $scope.itemrating = supplierProfile.Feedback.ItemAsDescribedRating;
    $scope.shiprating = supplierProfile.Feedback.ShippingAndHandlingChargesRating;
    $scope.shiptimerating = supplierProfile.Feedback.ShippingTimeRating;
    $scope.communicationrating = supplierProfile.Feedback.CommunicationRating;    
    $scope.ok = function () {
        $modalInstance.close();
    };
});
	
var getArray = function (data) {
    if (data == null) {
        return null;
    }
    if (data instanceof Array) {
        return data;
    }
    else {
        return [data];
    }
};

function getError (response) {
    return getArray(response.ErrorMessages)[0];
}

function getErrorStyle (error) {
    if (error.ErrorType == 'Warning') {
        return 'warningText';
    }
    else {
        return 'errorText';
    }
}

function initSelectedCountry ($rootScope, countryMap) {
    if (countryMap != null) {
        for (var i=0; i<countryMap.length; i++) {
            if (countryMap[i].isoCode == $rootScope.userCountry) {
                return countryMap[i];
            }
        }
    }
}

function updateShippingLocation($rootScope, selectedCountry, zipCode) {
    if (selectedCountry != null) {
        $rootScope.userCountry = selectedCountry.isoCode;
    }
    $rootScope.zipCode = zipCode;
}

spotbuyControllers.controller('RestrictionModalController', function ($rootScope, $scope, $modal) {
    $scope.showModal = function (message, customMessage) {
        $scope.message = message;
        $scope.customMessage = customMessage;
        var modalInstance = $modal.open({
            templateUrl: 'html/restrictionContent.html',
             controller: 'RestrictionMessageModalController',
             windowClass:'app-modal',

             resolve: {
                 keyword: function () {
                     return $rootScope.keyword;
                 },
                 message: function() {
                    return $scope.message;
                 },
                 customMessage: function() {
                    return $scope.customMessage;
                 }

             }
        });
    };

});


spotbuyControllers.controller('RestrictionMessageModalController', function ($scope, $modalInstance,keyword, message, customMessage) {
    $scope.keyword = keyword;
    $scope.message = message;
    $scope.customMessage = customMessage;
     $scope.ok = function () {
       $modalInstance.dismiss('cancel');
     };

});

spotbuyControllers.controller('ButtonNextController',function($scope, $rootScope, $window, $sce, $location, $timeout, SharedService) {
    $scope.buttonNext = function (relPath) {
        SharedService.prepForBroadcast($scope.refinementsChosen, $scope.breadcrumbs, $scope.categoriesChosen);
        $location.path(relPath);
    }

    $scope.goToSearchResultsPage = function () {
        SharedService.prepForBroadcast($scope.refinementsChosen, $scope.breadcrumbs, $scope.categoriesChosen);
        var fromBuyer = getQueryParam($window.location.hash, "fromBuyer");
        if (fromBuyer != null && fromBuyer == "true") {
            console.log("!!!! :: " + $location.absUrl());
            var iFrame = document.getElementById("GoToPreferredTabIFrame");
            if(iFrame) {
                var item = $scope.addToCartJson().replace("#"," ");
                var url = $sce.trustAsResourceUrl(
                        getSSPBaseUrl() +
                        "ad/returnToPreferredTab/ariba.catalog.searchui.SpotBuyDirectAction?realm=" +
                        $rootScope.realm + "&sessionId=" +  $rootScope.sessionId);
                iFrame.src = url;
            }
        }
        else {
            // Replace the Current URL to go back to Search Results Page.
            var currentUrl = $location.url();
            $location.url("items", currentUrl);
        }
    }
});

spotbuyControllers.controller('ModalImageController', function ($scope, $modal) {
    $scope.viewLargeImages = function () {
        var modalInstance = $modal.open({
            templateUrl: 'html/viewLargeImages.html',
             controller: 'ImageSetsController',
             windowClass:'image-modal-window',

             resolve: {
                 itemName: function () {
                    return $scope.item.ItemName;
                 },
                 mainImgUrl: function() {
                    return $scope.mainImageUrl;
                 },
                 imageSets: function() {
                    return $scope.picSets;
                 }

             }
        });
    };

});

spotbuyControllers.controller('ImageSetsController', function ($scope, $modalInstance, itemName, mainImgUrl, imageSets) {
    $scope.itemName = itemName;
    $scope.imageSets = imageSets;
    $scope.imageBackgroundSize = $(window).height() * 0.90;
    $scope.imgBackgroundStyle = {
          height : $scope.imageBackgroundSize+'px',
          width : $scope.imageBackgroundSize+'px'
    };

    $scope.imgThumbnailStyle = {
          "height": $scope.imageBackgroundSize*0.8 +'px',
          "overflow-y": "auto"
    };


    for (var i in imageSets) {
        if (imageSets[i].SmallImageUrl == mainImgUrl) {
            $scope.mainImg = imageSets[i];
            var image = new Image();
            image.src = $scope.mainImg.LargeImageUrl;
            getImageSize(image);
            break;
        }
    }


    function getImageSize (image) {
        var imageSize = $scope.imageBackgroundSize * 0.90;

        if (image.height > imageSize) {
            mainImageHeight = imageSize;
        } else {
            mainImageHeight = image.height;
        }
        if (image.width > imageSize) {
            mainImageWidth = imageSize;
        } else {
            mainImageWidth = image.width;
        }

        $scope.mainImageStyle = {
              "height" : mainImageHeight+'px',
              "width" : mainImageWidth+'px'
        };
    }

    $scope.setImage = function(img) {
        $scope.mainImg = img;
        var image = new Image();
        image.src = $scope.mainImg.LargeImageUrl;
        image.onload = function () {
            $scope.$apply(function() {
              getImageSize(image);
            });
        }
        getImageSize(image);
    };

    $scope.ok = function () {
       $modalInstance.dismiss('cancel');
    };

});


spotbuyControllers.controller('ViewDescriptionController', function ($scope, $modal) {
    $scope.viewDescription = function () {
        var modalInstance = $modal.open({
            templateUrl: 'html/details.html',
             controller: 'DescriptionController',
             windowClass:'desc-modal-window',

             resolve: {
                 itemDescription: function () {
                    return $scope.description;
                 }
             }
        });
    };
});

spotbuyControllers.controller('DescriptionController', function ($scope, $modalInstance, itemDescription) {
    $scope.itemDescription = itemDescription;
    $scope.ok = function () {
       $modalInstance.dismiss('cancel');
     };
});

spotbuyControllers.controller('SetupController', function ($scope, $rootScope, $window, $sce, AccountService, RestrictionService) {
    initParams($window, $rootScope);

    $scope.file = {};
    $scope.file.src = "";
    $scope.showAccountLoadingSpinner = true;
    $scope.fileHeader = "Commodity,Commodity Name,Username,Is Commodity Allowed,Price Threshold,Price Currency,Restriction Message"

    AccountService.getAccountService().success(function (response) {
        if (response.StatusCode == 200) {
            $scope.redirectLink = response.RedirectLink;
            console.log("redirect link" + response.redirectLink);

            $scope.accountStatus = response.AccountStatus;
            $scope.isAccountSetup = $scope.accountStatus != "NotSetUp";
            $scope.isAccountSetCollapsed = $scope.accountStatus == "Active";
            $scope.expirationDate = response.ExpirationDate;

            var t2 = new Date($scope.expirationDate);
            var t1 = new Date();
            var difference = parseInt((t2-t1)/(24*3600*1000));
            if (difference <= 30 && difference > 0) {
                $scope.expireIn = difference;
            }
        } else {
            $scope.UIErrorMessage = "Could not get account information. Try after sometime.";
        }
        $scope.showAccountLoadingSpinner = false;
    }).error(function (response) {
        console.log("get ebay redirect link error");
        $scope.showAccountLoadingSpinner = false;
        $scope.UIErrorMessage = "Could not get account information. Try after sometime.";
    });

    $scope.showSetupIframe = false;

    $scope.showSetupIframe = function () {
        return $scope.showSetupIframe;
    };

    // API for obtaining a url to resize the setup iframe based  on the current height of the page
    $scope.resizeSetupIframeUrl = function () {
        setIframeResizeUrl($rootScope.realm, $window.document.body.offsetHeight, 'SetupFrame', $sce);
    };

    // Import APIs
    $scope.importRestrictions = function() {
        if ($scope.file.src.lastIndexOf($scope.fileHeader, 0) !== 0) {
            $scope.FileErrorMessage = "The file does not appear to be in the correct format. Please download the template spreadsheet to view the expected format.";
            $scope.FileImportErrorMessage = null;
            $scope.FileImportSuccessMessage = null;
            return;
        }

        RestrictionService.importRestrictions($scope.getImportRestrictionsRequest($scope.file)).success(function (response) {
            if (response.StatusCode == 200) {
                $scope.FileImportSuccessMessage = "Restrictions imported successfully";
                $scope.FileErrorMessage = null;
                $scope.FileImportErrorMessage = null;
            }
            else {
                $scope.FileImportErrorMessage = response.ErrorMessages.Message;
                $scope.FileErrorMessage = null;
                $scope.FileImportSuccessMessage = null;
            }
        }).error(function (response) {
            $scope.showAccountLoadingSpinner = false;
            $scope.FileImportErrorMessage = "Error Messages\nUnable to import file";
            $scope.FileErrorMessage = null;
            $scope.FileImportSuccessMessage = null;
        });
    };

    $scope.getImportRestrictionsRequest = function (file) {
        return constructImportRestrictionsRequestJson(
            $rootScope.user,
            $rootScope.realm,
            $rootScope.realmAnId,
            $rootScope.sbtoken,
            file);
    };

    $scope.viewErrorFile = function () {
        $scope.promptFileDownload('CommodityRestrictionsImportErrors.csv', $scope.FileImportErrorMessage);
    }

    // Export APIs
    $scope.exportRestrictions = function() {
        RestrictionService.exportRestrictions($scope.getExportRestrictionsRequest()).success(function (response) {
            if (response.StatusCode != 200) {
                $scope.FileExportErrorMessage = "Could not export file: " + response.ErrorMessages.Message;
                $scope.FileExportSuccessMessage = null;
            }
            else {
                $scope.FileExportErrorMessage = null;
                $scope.FileExportSuccessMessage = null;
                $scope.promptFileDownload('CommodityRestrictions.csv', response.FileContents);
            }
        }).error(function (response) {
            $scope.showAccountLoadingSpinner = false;
            $scope.FileExportErrorMessage = "Unable to export file";
            $scope.FileExportSuccessMessage = null;
        });
    };

    $scope.getExportRestrictionsRequest = function () {
        return constructExportRestrictionsRequestJson(
            $rootScope.user,
            $rootScope.realm,
            $rootScope.realmAnId,
            $rootScope.sbtoken);
    };

    $scope.showImportBtn = function() {
        if ($scope.file.src) {
            return true;
        }
        return false;
    };

    $scope.promptFileDownload = function(fileName, fileContent) {
        var a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([fileContent], {type: 'text/csv'}));
        a.download = fileName;

        // Append anchor to body.
        document.body.appendChild(a)
        a.click();

        // Remove anchor from body
        document.body.removeChild(a);
    }

    this.setFileErrorMsg = function(errorMsg) {
        $scope.FileErrorMessage = errorMsg;
        $scope.FileImportErrorMessage = null;
        $scope.FileImportSuccessMessage = null;
    };

}).directive("fileread", [function () {
    return {
        require: "^ngController",
        scope: {
            fileread: "="
        },
        link: function(scope, el, attrs, ngCtrl){
            el.bind('change', function(event) {
                var file = event.target.files[0];

                // Validate file extension exists
                var filename = file.name.split(".");
                if(filename.length === 1 || ( filename[0] === "" && filename.length === 2 )) {
                    ngCtrl.setImportErrorMsg("File must have a valid CSV extension. For example, CommodityRestrictions.csv.");
                    scope.$apply();
                    return;
                }

                // Validate extension is csv file
                var fileExtension = filename.pop();
                if (fileExtension != "csv") {
                    ngCtrl.setFileErrorMsg("File must be a csv file");
                    scope.$apply();
                    return;
                }

                // Validate file size
                if (file.size > 1024 * 1024 * 4) {
                    ngCtrl.setFileErrorMsg("File size cannot exceed 4 MB");
                    scope.$apply();
                    return;
                }

                // Reset validation error msg
                ngCtrl.setFileErrorMsg(null);
                scope.$apply();

                // Read import file
                var reader = new FileReader();
                reader.onload = function (loadEvent) {
                    scope.$apply(function () {
                        scope.fileread = loadEvent.target.result;
                    });
                }
                reader.readAsText(file);
            });
        }
    }
}]);

spotbuyControllers.controller('OauthConfirmController', function ($scope, $modal) {
    $scope.oauthConfirmation = function () {
        var modalInstance = $modal.open({
            templateUrl: 'html/oathConfirm.html',
            controller: 'OauthConfirmationController',
            windowClass:'app-modal-window',
            resolve: {
                        redirectLink: function () {
                            return $scope.redirectLink;
                        }
                    }
        });
    };
});

spotbuyControllers.controller('OauthConfirmationController', function ($rootScope, $scope, $window, $modalInstance, redirectLink,OAuthTOUService) {
    $scope.ok = function () {
        OAuthTOUService.acceptTOU(constructTOURequest($rootScope.user,$rootScope.realm, $rootScope.realmAnId,
            $rootScope.sbtoken)).success(function (response) {
                if (response.StatusCode != 200) {
                    $scope.TOUErrorMessage = "Operation failed. Try again after sometime.";
                } else {
                    $modalInstance.dismiss('cancel');
                    $window.top.location.replace(redirectLink);
                }

            }).error(function (response) {
                $scope.TOUErrorMessage = "Operation failed. Try again after sometime.";
            });

     };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    }
});

spotbuyControllers.controller('CommodityMappingsController', function ($rootScope, $scope, CommodityMappingService) {
    $scope.canViewMappings = false;
    $scope.viewingMappings = false;
    $scope.viewUnspscMapping = true;
    $scope.viewMappedOnly = false;
    $scope.mappings = [];

    $scope.initMappings = function () {
        $scope.canViewMappings();
    }

    $scope.getCommodityMappingRequest = function () {
        return constructCommodityMappingRequestJson(
            $rootScope.user,
            $rootScope.realm,
            $rootScope.realmAnId,
            $rootScope.sbtoken);
    };

    $scope.canViewMappings = function () {
        CommodityMappingService.canViewMappings($scope.getCommodityMappingRequest()).success(function (response) {
            if (response.StatusCode == 200) {
                $scope.canViewMappings = response.canViewMappings;
            }
            else {
                $scope.canViewMappings = false;
            }
        }).error(function (response) {
            $scope.canViewMappings = false;
        });
    };

    $scope.showMappings = function () {
        $scope.retrieveUnspscMappings();
    }

    $scope.hideMappings = function () {
        $scope.viewingMappings = false;
    }

    $scope.enableMappedOnly = function () {
        $scope.viewMappedOnly = true;
    }

    $scope.disableMappedOnly = function () {
        $scope.viewMappedOnly = false;
    }

    $scope.retrieveUnspscMappings = function () {
        CommodityMappingService.retrieveUnspscMappings($scope.getCommodityMappingRequest()).success(function (response) {
            if (response.StatusCode == 200) {
                $scope.mappings = getArray(response.mappings);
                $scope.viewingMappings = true;
                $scope.viewUnspscMapping = true;
            }
            else {
                $scope.viewingMappings = false;
            }
        }).error(function (response) {
        });
    };

    $scope.retrieveStoreMappings = function () {
        CommodityMappingService.retrieveStoreMappings($scope.getCommodityMappingRequest()).success(function (response) {
            if (response.StatusCode == 200) {
                $scope.mappings = getArray(response.mappings);
                $scope.viewingMappings = true;
                $scope.viewUnspscMapping = false;
            }
            else {
                $scope.viewingMappings = false;
            }
        }).error(function (response) {
        });
    };

    $scope.viewUnspsc = function() {
        $scope.viewUnspscMapping = true;
        $scope.viewMappedOnly = false;
        $scope.retrieveUnspscMappings();
    }

    $scope.viewStore = function() {
        $scope.viewUnspscMapping = false;
        $scope.viewMappedOnly = false;
        $scope.retrieveStoreMappings();
    }

    $scope.showMapping = function(mapping) {
        if ($scope.viewMappedOnly) {
            var hasChildren = $scope.hasChildren(mapping);
            var hasMapping = $scope.hasMapping(mapping);
            if (!hasChildren && !hasMapping) {
                return false;
            }
        }
        return true;
    }

    $scope.hasChildren = function(mapping) {
        if (mapping.mappings == null) {
            return false;
        }

        if (mapping.mappings.length == 0) {
            return false;
        }

        // If viewing only mapped items, skip if mapping does not have any mapped children
        var hasMappedChildren = (mapping.hasMappedChildren === "true");
        if ($scope.viewMappedOnly && !hasMappedChildren) {
            return false;
        }

        mapping.mappings = getArray(mapping.mappings);
        return true;
    };

    $scope.hasMapping = function(mapping) {
        if (mapping.associations == null) {
            return false;
        }

        if (mapping.associations.length == 0) {
            return false;
        }

        mapping.associations = getArray(mapping.associations);
        return true;
    }

    $scope.toggleChildren = function(mapping) {
        mapping.childrenVisible = !mapping.childrenVisible;
    };
});
