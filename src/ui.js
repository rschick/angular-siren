angular.module('angular-siren.ui', [
	'angular-siren.navigator'
])

.provider('SirenUi', function SirenUiProvider() {

	var entityMap = {};
	var actionMap = {};

	var conf = {
		entityPrefix: '',
		actionPrefix: ''
	};

	function configure(opts) {
		conf = _.assign(conf, opts);
		return this;
	}

	function mapEntities(map) {
		_.assign(entityMap, map);
		return this;
	}

	function mapActions(map) {
		_.assign(actionMap, map);
		return this;
	}

	function getElementNameForClasses(entityClasses) {
		entityClasses = [].concat(entityClasses);

		var bestMatch = {
			elementName: 'unknown',
			count: 0
		};

		_.forEach(entityMap, function(classes, elementName) {

			if (!entityMap.hasOwnProperty(elementName)) {
				return;
			}

			classes = [].concat(classes);

			var count = _.reduce(_.map(classes, function(cls) {
				return entityClasses.indexOf(cls) >= 0 ? 1 : 0;
			}), function(total, n) {
				return total + n;
			});

			if (count > bestMatch.count) {
				bestMatch.elementName = elementName;
				bestMatch.count = count;
			}
		});

		if (bestMatch.count === 0) {
			bestMatch.elementName = entityClasses.sort().join('-');
		}

		return conf.entityPrefix + bestMatch.elementName;
	}

	function getElementNameForAction(actionName) {

		var elementName = actionName;

		_.forEach(actionMap, function(names, name) {
			names = [].concat(names);
			if (names.indexOf(actionName) >= 0) {
				elementName = name;
			}
		});

		return conf.actionPrefix + elementName;
	}

	this.configure = configure;
	this.mapEntities = mapEntities;
	this.mapActions = mapActions;
	this.getElementNameForClasses = getElementNameForClasses;
	this.getElementNameForAction = getElementNameForAction;

	this.$get = function SirenUiFactory() {

		function SirenUi() {

			return {
				mapEntities: mapEntities,
				mapActions: mapActions,
				getElementNameForClasses: getElementNameForClasses,
				getElementNameForAction: getElementNameForAction,
				configure: configure
			};
		}

		return new SirenUi();
	};
}).

directive('navHref', function(SirenNavigator) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			attrs.$observe('navHref', function() {
				var href = typeof attrs.navHref === 'object' ? attrs.navHref.href : attrs.navHref;
				element.attr('href', SirenNavigator.api2app(href));
			});
		}
	};
}).

directive('entity', function($compile, SirenUi) {
	return {
		restrict: 'E',
		scope: {
			entity: '='
		},
		link: function ($scope, element, attrs) {

			function createEntity() {
				var elementName = SirenUi.getElementNameForClasses($scope.entity ? $scope.entity.class : undefined);
				var template = '<' + elementName + ' entity="entity" />';
				element.empty();
				element.append($compile(template)($scope));
			}

			$scope.$watch('entity.class', function() {
				createEntity();
			});
		}
	};
}).

directive('action', function($compile, SirenUi) {
	return {
		restrict: 'E',
		scope: {
			action: '=',
			entity: '='
		},
		link: function ($scope, element, attrs) {

			function createElement() {
				var elementName = SirenUi.getElementNameForAction(($scope.action && $scope.action.name) || 'unknown');
				var template = '<' + elementName + ' entity="entity" action="action" />';
				element.empty();
				element.append($compile(template)($scope));
			}

			$scope.$watch('action.name', function() {
				createElement();
			});
		}
	};
});
