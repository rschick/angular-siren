angular.module('angular-siren.navigator', [])

.provider('SirenNavigator', function SirenNavigatorProvider() {

	var conf = {
		baseUrl: '',
		hashPrefix: '#/browse',
		authorization: '',
		externalRequestHandler: null
	};

	function configure(opts) {
		conf = _.assign(conf, opts);
		return this;
	}

	this.configure = configure;

	this.$get = function SirenNavigatorFactory($http, $q, $window) {

		function Navigator() {
			var currentUrl;
			var entity = {
				properties: [],
				entities: [],
				links: {},
				actions: {},
				'class': []
			};
			var etag;
			var savedProperties;

			function loadEntity(data, target) {

				target.class = data.class;
				target.properties = data.properties;
				target.entities = data.entities;
				target.links = data.links;
				target.actions = data.actions;

				target.class.contains = function(search) {
					return _.every([].concat(search), function(cls) {
						return target.class.indexOf(cls) >= 0;
					});
				};

				_.each(data.links, function(link) {
					link.follow = function(opts) {
						return follow(link, opts);
					};
					target.links[link.rel] = link;
				});

				_.each(data.actions, function(action) {
					action.execute = function(opts) {
						return execute(action, opts);
					};

					_.each(action.fields, function(field) {
						action.fields[field.name] = field;
					});

					target.actions[action.name] = action;
				});

				_.each(target.entities, function(entity, key) {
					_.each(entity.links, function(link) {
						link.follow = function(opts) {
							return follow(link, opts);
						};
						entity.links[link.rel] = link;
					});
				});

				return target;
			}

			function serialize(obj) {
				var str = [];
				for(var p in obj) {
					if (obj.hasOwnProperty(p)) {
						str.push(encodeURIComponent(p) + '=' + encodeURIComponent(obj[p]));
					}
				}
				return str.join('&');
			}

			function isAbsoluteUrl(url) {
				return (url.indexOf('http://') === 0 || url.indexOf('https://') === 0);
			}

			function isExternalUrl(url) {
				return url.indexOf(conf.baseUrl) !== 0;
			}

			/*
			 * http://<apiBase>/courses => #/browse/courses
			 * http://<randomUrl>/path => http://<randomUrl>/path (will navigate outside the app)
			 */
			function api2app(apiUrl) {
				var appUrl = apiUrl;
				if (!isAbsoluteUrl(apiUrl)) {
					appUrl = conf.baseUrl + appUrl;
				}
				if (apiUrl.indexOf(conf.baseUrl) === 0) {
					appUrl = conf.hashPrefix + apiUrl.substring(conf.baseUrl.length);
				}
				return appUrl;
			}

			/*
			 * #/browse/courses => http://<apiBase>/courses
			 */
			function app2api(appUrl) {
				return conf.baseUrl + unescape(unescape(appUrl.substring(conf.hashPrefix.length)));
			}

			/*
			 * Updates the browser location based on an API location
			 *
			 * If the location isn't already loaded, this will result in reloading the entity
			 * via the hashchange listener.
			 */
			function setAppLocation(apiUrl) {
				var appUrl = api2app(apiUrl);
				if (isAbsoluteUrl(appUrl)) {
					$window.location.href = appUrl;
				} else {
					$window.location.hash = appUrl;
				}
			}

			/*
			 * Follow a link
			 *
			 * entity: target entity to load into, otherwise a new entity is returned
			 */
			function $follow(apiUrl, entity) {

				if (isExternalUrl(apiUrl)) {
					var action = {
						href: apiUrl,
						method: 'GET'
					};
					return $q.when(conf.externalRequestHandler(action, entity));
				}

				currentUrl = apiUrl;

				var deferred = $q.defer();

				var options = {
					method: 'GET',
					url: currentUrl,
					headers: {
						Accept: 'application/vnd.siren+json, application/json, text/plain, */*'
					}
				};

				if (conf.authorization) {
					options.headers.Authorization = conf.authorization;
				}

				$http(options)
					.success(function(data, status, headers, config) {

						etag = headers('ETag');

						deferred.resolve({
							data: data,
							status: status,
							headers: headers,
							config: config,
							entity: status === 200 && loadEntity(data, entity)
						});
					})
					.error(function(data, status, headers, config) {
						deferred.reject(status);
					});

				return deferred.promise;
			}

			/*
			 * Execute an action
			 *
			 * entity: target entity to load into, otherwise a new entity is returned
			 */
			function $execute(action, entity) {
				var contentType = action.type || 'application/x-www-form-urlencoded';

				if (isExternalUrl(action.href)) {
					return $q.when(conf.externalRequestHandler(action, entity));
				}

				var options = {
					method: action.method || 'GET',
					url: action.href,
					headers: {
						'Content-Type': contentType,
						Accept: 'application/vnd.siren+json, application/json, text/plain, */*'
					}
				};

				if (conf.authorization) {
					options.headers.Authorization = conf.authorization;
				}

				if (options.method === 'GET') {
					var params = {};

					angular.forEach(action.fields, function(field) {
						params[field.name] = field.value || '';
					});

					var apiUrl = options.url.split('?')[0] + '?' + serialize(params);

					return $follow(apiUrl, entity);
				} else {

					if (['PUT', 'PATCH', 'DELETE'].indexOf(options.method) >= 0) {
						if (etag) {
							options.headers['If-Match'] = etag;
						}
					}

					if (contentType === 'application/json') {
						options.data = {};
						angular.forEach(action.fields, function(field) {
							options.data[field.name] = field.value;
						});
					} else if (contentType === 'application/json-patch+json') {
						options.data = jsonpatch.compare(savedProperties, entity.properties);
					} else if (contentType === 'application/x-www-form-urlencoded') {
						var data = [];
						angular.forEach(action.fields, function(field) {
							data.push(encodeURIComponent(field.name) + '=' + encodeURIComponent(field.value));
						});
						options.data = data.join('&');
					}

					var deferred = $q.defer();

					currentUrl = options.url;

					$http(options).success(function(data, status, headers, config) {

						var location = headers('location');
						if (location) {
							return $follow(headers('location'), entity)
								.then(function(result) {
									deferred.resolve(result);
								})
								.then(null, function(error) {
									deferred.reject(error);
								});
						}

						deferred.resolve({
							data: data,
							status: status,
							headers: headers,
							config: config,
							entity: status === 200 && loadEntity(data, entity)
						});
					})
					.error(function(data, status, headers, config) {
						deferred.reject(status);
					});

					return deferred.promise;
				}
			}

			/*
			 * Follow a link
			 *
			 * opts:
			 *   replace:
			 *     true:  (default) the current entity is replaced with the result and the
			 *            window.location is updated.
			 *     false: the entity result is returned without replacing the current entity
			 *            or updating window.location.
			 */
			function follow(apiUrl, opts) {

				apiUrl = typeof apiUrl === 'object' ? apiUrl.href : apiUrl;

				opts = _.assign({
					replace: true
				}, opts);

				var uri = new UriTemplate(apiUrl);
				apiUrl = uri.fill(opts);

				return $follow(apiUrl, opts.replace ? entity : {})
					.then(function(result) {
						if (result && opts.replace) {
							savedProperties = _.cloneDeep(entity.properties);
							etag = result.headers('ETag');
							setAppLocation(result.config.url);
						}
						return $q.when(result);
					});
			}

			/*
			 * Execute an action
			 *
			 * opts: see folow()
			 */
			function execute(action, opts) {

				opts = _.assign({
					replace: true
				}, opts);

				return $execute(action, opts.replace ? entity : {})
					.then(function(result) {
						if (result && opts.replace) {
							savedProperties = _.cloneDeep(entity.properties);
							etag = result.headers('ETag');
							setAppLocation(currentUrl);
						}
						return $q.when(result);
					});
			}

			/*
			 * Reloads the current entity with the current window location
			 */
			function reload() {

				if (!conf.baseUrl) {
					return;
				}

				var apiUrl = app2api($window.location.hash);
				if (apiUrl !== currentUrl) {
					$follow(apiUrl, entity)
						.then(function(result) {
							if (result) {
								savedProperties = _.cloneDeep(entity.properties);
								etag = result.headers('ETag');
							}
						});
				}
			}

			function defaultExternalRequestHandler(action, entity) {
				return false;
			}

			$window.addEventListener('hashchange', function() {
				if ($window.location.hash.indexOf(conf.hashPrefix) === 0) {
					reload();
				}
			});

			conf.externalRequestHandler = defaultExternalRequestHandler;

			this.configure = configure;
			this.reload = reload;
			this.entity = entity;
			this.follow = follow;
			this.execute = execute;
			this.api2app = api2app;
		}

		return new Navigator();
	};
})

.directive('sirenBaseUrl', function(SirenNavigator) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			SirenNavigator.configure({
				baseUrl: attrs.sirenBaseUrl
			});
		}
	};
});
