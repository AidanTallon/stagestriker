// How to handle user joining room after it the room has started? Limit to 2 users?
// How to handle disconnects and reconnects?
// Should there be a way for an admin to join a room and have access to logs?

var socket;

var user;

var room;

var buttonArr = {};

var chatlog = [];

var User = function(username, id) {
	this.username = username;
	this.id = id;
};

var Room = function(id, game, stages, users) {
	this.id = id;
	this.game = game;
	this.stages = stages;
	this.users = users;
};

var screenArr = ['login-screen-container', 'start-screen-container', 'room-screen-container'];
var overlayArr = ['start-screen-host-overlay', 'start-screen-join-overlay'];

function hideAllScreens() {
	screenArr.forEach(function(screen) {
		document.getElementById(screen).className = 'hiddenScreen';
	});
}

function showLoginScreen() {
	var screen = document.getElementById('login-screen-container');
	screen.className = 'openScreen';
	var nameInput = document.getElementById('login-input');
	nameInput.innerHTML = '';
	var errorMsg = document.getElementById('login-error-message');
	errorMsg.innerHTML = '';
}

function showStartScreen() {
	var screen = document.getElementById('start-screen-container');
	screen.className = 'openScreen';
	var nameDisplay = document.getElementById('start-screen-username');
	nameDisplay.innerHTML = user.username;
	var idDisplay = document.getElementById('start-screen-id');
	idDisplay.innerHTML = user.id;
}

function showRoomScreen() {
	var screen = document.getElementById('room-screen-container');
	screen.className = 'openScreen';
}

function showHostOverlay() { // TODO: Test room closes after cancel
	var overlay = document.getElementById('start-screen-host-overlay');
	overlay.className = 'openOverlay';
	var hostForm = document.getElementById('game-select');
	hostForm.reset();
	hostForm.style.display = 'block';
	var instructions = document.getElementById('start-screen-host-instructions');
	instructions.style.display = 'none';
	var hostBtn = document.getElementById('host-overlay-host-button');
	hostBtn.disabled = false;
	hostBtn.innerHTML = 'HOST';
	var idDisplay = document.getElementById('start-screen-host-code');
	idDisplay.innerHTML = '';
	var errMsg = document.getElementById('host-overlay-error-message');
	errMsg.innerHTML = '';
}

function showJoinOverlay() {
	var overlay = document.getElementById('start-screen-join-overlay');
	overlay.className = 'openOverlay';
	var idInput = document.getElementById('join-room');
	idInput.reset();
	var errMsg = document.getElementById('join-overlay-error-message');
	errMsg.innerHTML = '';
}

function hideAllOverlays() {
	overlayArr.forEach(function(overlay) {
		document.getElementById(overlay).className = 'hiddenOverlay';
	});
}

function clickLogin() { // TODO: Check not already logged in.
	var e = document.getElementById('login-error-message');
	e.innerHTML = '';
	var input = document.getElementById('login-input');
	var username = input.value;
	input.value = '';
	if (username == '') {
		loginErr('Username must not be blank.');
		return;
	}
	else if (username.length > 32) {
	loginErr('Username must be less than 32 characters.');
	}
	else {
		login(username);
	}
}

function loginErr(errMsg) {
	var e = document.getElementById('login-error-message');
	e.innerHTML = errMsg;
}

function onLogin() {
	hideAllScreens();
	showStartScreen();
}

function openHostMenu() {
	hideAllOverlays();
	showHostOverlay();
}

function openJoinMenu() {
	hideAllOverlays();
	showJoinOverlay();
}

function clickHost() {
	var errorMsg = document.getElementById('host-overlay-error-message');
	errorMsg.innerHTML = '';
	var hostForm = document.getElementById('game-select');
	var game = hostForm.game.value;
	if (game == '') {
		hostErr('Please select game.');
	}
	else {
		var codeDisplayDiv = document.getElementById('start-screen-host-instructions');
		var hostBtn = document.getElementById('host-overlay-host-button');
		var gameTitleDisplay = document.getElementById('game-selected-title');
		gameTitleDisplay.innerHTML = game;
		hostBtn.disabled = true;
		hostBtn.innerHTML = 'Waiting...';
		host(socket.id, game);
		hostForm.style.display = 'none';
		codeDisplayDiv.style.display = 'block';
		
	}
}

function displayRoomCode(id) { // TODO: Cross-browser compatibility. New function for getselection checks and executes
	var codeDisplay = document.getElementById('start-screen-host-code');
	codeDisplay.innerHTML = id;
	var range = document.createRange();
	range.selectNode(codeDisplay);
	window.getSelection().removeAllRanges();
	window.getSelection().addRange(range);
}

function hostErr(msg) {
	var errorMsg = document.getElementById('host-overlay-error-message');
	errorMsg.innerHTML = msg;
}

function clickJoin() {
	var errorMsg = document.getElementById('join-overlay-error-message');
	errorMsg.innerHTML = '';
	var joinForm = document.getElementById('join-room');
	var roomCode = joinForm.code.value;
	join(roomCode);
}

function joinErr(msg) {
	var errorMsg = document.getElementById('join-overlay-error-message');
	errorMsg.innerHTML = msg;
}

function clickCancelHost() {
	hideAllOverlays();
	showStartScreen();
	cancelHostOrJoin();
}

function clickCancelJoin() {
	hideAllOverlays();
	showStartScreen();
	cancelHostOrJoin();
}

function loadGame() {
	buttonArr = [];
	var starterDiv = document.getElementById('starter-stage-container');
	var counterDiv = document.getElementById('counterpick-stage-container');
	var gameTitle = document.getElementById('room-screen-game-title');
	gameTitle.innerHTML = room.game;
	for (var stage in room.stages) {
		buttonArr[stage] = makeStageButton(room.stages[stage]);
		if (room.stages[stage].type == 'Starter') {
			starterDiv.appendChild(buttonArr[stage]);
		}
		else if (room.stages[stage].type == 'Counterpick') {
			counterDiv.appendChild(buttonArr[stage]);
		};
	};
}

function openRoomScreen() { // TODO: remove
	showRoomScreen();
}

function makeStageButton(stage) {
	var btn = document.createElement('BUTTON');
	btn.innerHTML = stage.name;
	btn.onclick = function() {
		return strikeStage(stage);
	};
	btn.className = 'availableStage';
	return btn;
}

function clickSendChat() {
	var msg = document.getElementById('chat-input').value;
	sendChat(msg);
	document.getElementById('chat-input').value = '';
}

function addToChat(user, msg) {
	var li = document.createElement('LI');
	li.innerHTML = user + ': ' + msg;
	li.className = 'chat-message';
	var chatDisplay = document.getElementById('chat-log');
	chatDisplay.appendChild(li);
	chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function login(username) {
	if (!socket) {
		socket = io();
	}
	socket.emit('login', username);
	socket.on('login', function(data) {
		if (!user) {
			if (data['success']) {
				user = new User(data['username'], data['id']);
				socket.off('login');
				onLogin();
			}
			else if (data['success'] == false) {
				loginErr(data['errorMessage']);
			}
		}
	});
}

function host(id, game) {
	socket.emit('create', id, game);
	socket.on('created', function(data) {
		if (data['success']) {
			room = new Room(data['roomId'], data['game'], data['stages'], data['users']);
			socket.off('created');
			socket.on('joined', function(data) {
				room.users = data['users'];
				startRoom();
			});
			displayRoomCode(data['roomId']);
		}
		else if (!data['success']) {
			// TODO: error stuff
			hostErr(data['errorMessage']);
			socket.off('created');
		};
	});
}

function join(roomCode) {
	socket.emit('join', roomCode);
	socket.on('joined', function(data) {
		if (data['success']) {
			socket.off('joined');
			room = new Room(data['roomId'], data['game'], data['stages'], data['users']);
			startRoom();
		}
		else if (!data['success']) {
			//TODO: error stuff
			joinErr(data['errorMessage']);
			socket.off('joined');
		};
	});
}

function cancelHostOrJoin() {
	socket.off('created');
	socket.off('joined');
	socket.emit('leave');
}

function startRoom() {
	loadGame();
	hideAllScreens();
	openRoomScreen();
	
	socket.on('strike', function(data) {
		var stage = room.stages[data['stageName']];
		stage.struck = data['struck'];
		if (stage.struck == false) {
			buttonArr[stage.name].className = 'availableStage';
		}
		else if (stage.struck == true) {
			buttonArr[stage.name].className = 'struckStage';
		};
	});
	
	socket.on('message', function(data) {
		addToChatLog(data);
	});
}

function leaveRoom() { // TODO
	socket.off('strike');
	socket.off('message');
	socket.emit('leave');
}

function strikeStage(stage) {
	if (stage.struck == true) {
		stage.struck = false;
	}
	else if (stage.struck == false) {
		stage.struck = true;
	};
	socket.emit('strike', stage);
}

function sendChat(msg) {
	msg = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	var data = {'userId': user.id, 'username': user.username, 'roomId': room.id, 'timestamp': Date(), 'message': msg};
	addToChatLog(data);
	socket.emit('message', data);
};

function addToChatLog(data) {
	chatlog.push(data);
	addToChat(data['username'], data['message']);
};

function copyToClipboard() { // TODO: Cross-browser compatibility
	var codeDisplay = document.getElementById('start-screen-host-code');
	var range = document.createRange();
	range.selectNode(codeDisplay);
	window.getSelection().removeAllRanges();
	window.getSelection().addRange(range);
	document.execCommand('copy');
}