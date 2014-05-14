'use strict';

define(['controllers', 'underscore', 'modules/socketConnector'], function (controllers, _, connector){
	controllers.controller('talkCtrl', [ '$scope', '$routeParams', '$location', '$anchorScroll', function($scope, $routeParams, $location, $anchorScroll){
		$scope.serverStatus = connector.status;		
		connector.addListener('statusChanged', serverStatusChanged);
		function serverStatusChanged (status){
			$scope.$apply(function(){
				$scope.serverStatus = status;
			});
		};

		connector.runWithConnection(function(){
			var connectionId = null;
			$scope.channelId = $routeParams.channelId;
			$scope.me = new TalkUser($routeParams.userid, $routeParams.username, 'http://placehold.it/50/FA6F57/fff&text=ME');
			$scope.others = [];
			$scope.talks = [];
			$scope.lastTalk = null;
			connector.request('getUserFromChannel', {
				channelId:$scope.channelId, 
				userId:$scope.me.id},
				function(res){
					if (res.result){
						$scope.me.id = res.result.id;
						$scope.me.name = res.result.name;
						joinChannel();
					}
					else{
						connector.request('addUserToChannel', {
							channelId:$scope.channelId, 
							userName:$scope.me.name,
							userId:$scope.me.id}, 
							function(res){
								if (!res.err && res.result && res.result.id){
									refreshWithUserId(res.result.id);
								}
							}
						);
					}				
				}
			);

			$scope.$on('$destroy', function cleanup() {
				console.log('destroy');
				releaseConnectorEvents();

				if (connectionId){
					connector.request('leaveChannel', {connectionId:connectionId}, function(res){
						console.log('leaveChannel');
					});
				}
			});

			
			$scope.getUser = function (userId) {
				if ($scope.me.id === userId){
					return $scope.me;
				}

				var selectedUsers = $scope.others.filter(function(item){ return item.id === userId;});
				if (selectedUsers && selectedUsers.length > 0)
				{
					return selectedUsers[0];
				}

				return null;
			};

			$scope.addUser = function (user) {
				if (!user || !(user instanceof TalkUser))
				{
					return null;
				}

				var selectedUsers = $scope.others.filter(function(item){return item.id === user.id;});

				if (selectedUsers.length > 0){
					// 존재한다면;
					var selectedUser = selectedUsers[0];
					selectedUser.update(user);
				}
				else{
					// 같은 ID를 가진 놈이 없다면 추가하라.
					$scope.others.push(user);
					return user;
				}

				return null;
			};

			$scope.removeUser = function (userId) {
				var user = $scope.getUser(userId);

				if (user)
				{
					$scope.others.splice($scope.others.indexOf(user), 1);
				}

				return user;
			};

			$scope.inputKeypress = function($event){
				if ($event.keyCode === 13) // Enter key pess
				{
					$scope.sendMessage();
				}
			};

			$scope.sendMessage = function(){
				if (!$scope.inputTalkMessage){
					return;
				}

				var talk = addTalk({user:$scope.me, message:$scope.inputTalkMessage});

				// console.log(inputTalkMessage);
				console.log($scope.inputTalkMessage);
				$scope.inputTalkMessage = '';
				talk.channelId = $scope.channelId;
				connector.request('addNewTalk', talk, function(res){
					$scope.$apply(function(){
						if (_.any($scope.talks, function (item){return item.id === res.result.id;})){
							$scope.talks.splice(_.indexOf($scope.talks, talk), 1);
						}
						else{
							talk.id = res.result.id;
							talk.time = res.result.time;
						}	
					});
				});
			};

			function onNewTalk(talk){
				$scope.$apply(function(){
					addTalk(talk);					
				});

				$scope.$apply(function(){
					$location.hash('bottom');
		      		$anchorScroll();	
				});			
			}

			function onAddUser(user){
				$scope.$apply(function(){
					$scope.addUser(new TalkUser(user.id, user.name, user.avatar, user.connections));
				});
			}

			function onRemoveUser(userId){
				$scope.$apply(function(){
					$scope.removeUser(userId);
				});	
			}

			function onUpdateUser(data){
				console.log(data);
				if (data.userId && data.propertyName){
					var user = $scope.getUser(data.userId);
					if (user){
						$scope.$apply(function(){
							user[data.propertyName] = data.data;	
						});
					}	
				}
			}

			function onReconnected(){
				joinChannel(true);
			}

			function addTalk(data){
				if (_.any($scope.talks, function (talk){return talk.id === data.id;})){
					return;
				}

				var newTalk = new Talk(data);
				$scope.talks.push(newTalk);
				$scope.lastTalk = newTalk;
				return newTalk;
			}

			function joinChannel(isReconnected){
				connector.request('joinChannel', {channelId:$scope.channelId, userId:$scope.me.id}, function(res){
					console.log('joinChannel');
					if (res.err){
						alert(err);
					}
					else{			
						// channelCache[$scope.channelId] = $scope.me.id;		
						setConnectorEvents();					
						connectionId = res.result.connectionId;
						var users = res.result.users;
						var talks = res.result.talks;
						
						if (users && _.isArray(users)){
							_.each(users, function (user){ $scope.addUser(new TalkUser(user.id, user.name, user.avatar, user.connections)); });
						}

						if (talks && _.isArray(talks)){
							_.each(talks, function (talk){ addTalk(talk); });
						}

						$scope.$apply();
					}
				});
			}

			function setConnectorEvents(){		
				connector.addListener('reconnected', onReconnected);			
				connector.addEventListener('onNewTalk', $scope.channelId, onNewTalk);
				connector.addEventListener('onAddUser', $scope.channelId, onAddUser);
				connector.addEventListener('onRemoveUser', $scope.channelId, onRemoveUser);
				connector.addEventListener('onUpdateUser', $scope.channelId, onUpdateUser);	
			}

			function releaseConnectorEvents(){				
				connector.removeListener('reconnected', onReconnected);
				connector.removeEventListener('onNewTalk', $scope.channelId, onNewTalk);
				connector.removeEventListener('onAddUser', $scope.channelId, onAddUser);
				connector.removeEventListener('onRemoveUser', $scope.channelId, onRemoveUser);
				connector.removeEventListener('onUpdateUser', $scope.channelId, onUpdateUser);	

				connector.removeListener('statusChanged', serverStatusChanged);
			}

			function refreshWithUserId(userId){
				window.location = encodeURI(window.location.pathname + '#/ch/' + $scope.channelId + '?userid=' + userId);
			}

			if(!$scope.$$phase) {
				$scope.$apply();
			}
		});
	}]);

	var Talk = (function(){
		function Talk(data){
			this.id = data.id;
			this.message = data.message;
			this.time = data.time ? new Date(data.time) : null;
			this.user = data.user;
		}

		return Talk;
	})();

	var TalkUser = (function () {
			function TalkUser(id, name, avatar, connections) {
				this.id = id;
				this.name = name;
				this.connections = connections;
				this.avatar = avatar || 'http://placehold.it/50/55C1E7/fff&text=U';
			}

			TalkUser.prototype.getSimpleUser = function() {
				return {id:this.id, name:this.name};
			};

			TalkUser.prototype.update = function(user) {
				this.name = user.name;
				this.connections = user.connections;
			};

			TalkUser.prototype.isAlive = function(){
				return _.isArray(this.connections) && this.connections.length > 0;
			};

			return TalkUser;
	})();
});
