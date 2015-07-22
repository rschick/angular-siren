angular.module('angular-siren.ui', [
	'angular-siren.navigator'
])

.factory('SirenEntityMapper', function() {

	var conf = {
		entityPrefix: 'entity-'
	};

	var entityMap = {};

	return {

		map: function(map) {
			_.assign(entityMap, map);
			return this;
		},

		getElementName: function(entity) {
			var entityClasses = [].concat((entity && entity.class) || undefined);

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
	};
})

.factory('SirenActionMapper', function() {
	var actionMap = {};
	var conf = {
		actionPrefix: 'action-'
	};

	return {

		map: function(map) {
			_.assign(actionMap, map);
			return this;
		},

		getElementName: function(action) {
			var elementName = (action && action.name) || 'unknown';
			_.forEach(actionMap, function(names, name) {
				names = [].concat(names);
				if (names.indexOf(action.name) >= 0) {
					elementName = name;
				}
			});
			return conf.actionPrefix + elementName;
		}
	};
})

.factory('SirenUi', function SirenUiFactory(SirenEntityMapper, SirenActionMapper) {

	var conf = {
		entityMapper: SirenEntityMapper,
		actionMapper: SirenActionMapper
	};

	return {
		getElementForEntity: function(entity) {
			return conf.entityMapper.getElementName(entity);
		},
		getElementForAction: function(action) {
			return conf.actionMapper.getElementName(action);
		},
		configure: function (opts) {
			conf = _.assign(conf, opts);
			return this;
		}
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
				var elementName = SirenUi.getElementForEntity($scope.entity);
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
				var elementName = SirenUi.getElementForAction($scope.action);
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
