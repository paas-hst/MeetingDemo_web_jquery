
$(function(){
    // 初始化Tab显示状态
    $('#tab1').show();
    $('#tab-btn-0').css("background-color", "rgb(106,125,254)");
    $('#tab2').hide();
    $('#tab3').hide();
    $('#tab4').hide();

    // Tab切换控制
    var btns = $('#tabs button');
    btns.click(function(){
        var clickIndex = parseInt(btns.index(this));
        for (var i = 0; i < btns.length; i++){
            if (clickIndex == i){
                $('#tab'+ (i + 1)).show();
                btns[i].setAttribute("style", "background-color: rgb(106,125,254); color: white");
            } else {
                $('#tab' + (i + 1)).hide();
                btns[i].setAttribute("style", "background-color: white; color: black");
            }
        }
    });

    updateGroupUserList();
    updateAppState(0);
    updateVideoPanelLayout();
});

////////////////////////////////////////////////////////////////////////////////
// 全局变量声明、定义和初始化
////////////////////////////////////////////////////////////////////////////////

// 分组内聊天消息和系统消息
let allMsg = "";

// 登录凭证
let appId = '7a02a8217cd541f990152ea666ee24bf';
let token = '001Sx04XAA406DvYyD8J3oEh/eSZFnogbLaFnwlXozD6QfHszwvHlCNRVj3wjIxldlRYRG28cGFdK9xgku3fhdMKY2pB3j1It4Omq8Quxx4xFH/2h3MbrWmsVCjh/N1cfsx';

// 登录信息
let userId = "";
let groupId = "";

// 初始化视频显示区域，固定6个显示区域
let videoPanels = [];
for (let i = 0; i < 6; i++){
    videoPanels.push({
        index: i,
        handle: document.getElementById('video-panel-' + i),
        used: false,
        userId: "",
        audioId: "",    // audio mediaId
        videoId: "",    // video mediaId
        streamId: ""
    });
}

// 初始化屏幕共享显示区域，固定2个显示区域
let screenSharePanels = [];
for (let i = 0; i < 2; i++) {
    screenSharePanels.push({
        index: i,
        handle: document.getElementById('screen-share-panel-' + i),
        used: false,
        userId: "",
        shareId: ""
    });
}

// 是否正在广播麦克风设备
let isPublishAudio = false;

// 是否正在屏幕共享
let isScreenSharing = false;

// 分组用户列表
let groupUserList = new Map();

// 在线用户列表
let onlineUserList = new Set();

// 创建实时音视频引擎
let hstRtcEngine = new HstRtcEngine();

////////////////////////////////////////////////////////////////////////////////
// 控件行为定义
////////////////////////////////////////////////////////////////////////////////

// 窗口大小变化的时候，需要刷新VideoPanel布局
$(window).resize(function(){
    updateVideoPanelLayout();
});

// 鼠标双击视频窗口和屏幕共享窗口最大化显示处理
function toggleMaxPanel(){
    
    if ($(this).attr("max") === "false"){
        $(this).attr("style", "position: absolute; left: 0; top: 0; z-index: 9999; width: 100vw; height: 100vh");
        $(this).attr("max", "true");
    } else {
        $(this).attr("style", "");
        $(this).attr("max", "false");
    }
}
$(".video-panel").dblclick(toggleMaxPanel);
$(".screen-share-panel").dblclick(toggleMaxPanel);

// 鼠标点击“初始化”按钮处理
$("#init-btn").click(function () {
    hstRtcEngine.init()
    .then(function(param){
        addSystemMsg("Init success.", param);
        updateAppState(1);
        loadMediaDevList();
    })
    .catch(function(){
        addSystemMsg("Init failed!");
    })        
});

// 鼠标点击“登录”按钮处理
$('#login-btn').click(function () {
    let inputUserId = document.getElementById('user-id').value
    let loginOpt = {
        appId: appId,
        token: token,
        companyId: "",
        userId: inputUserId
    }
    
    hstRtcEngine.login(loginOpt)
    .then(() => {
        window.userId = inputUserId;
        // 登录成功后，应立即获取全量在线用户列表，后续服务器只会通知增量在线用户
        getOnlineUserList();
        updateAppState(2);

        addSystemMsg("Login success.");
    })
    .catch (() => {
        addSystemMsg("Login failed!");
    })     
});

// 鼠标点击“退出登录”按钮处理
$("#exit-btn").click(function () {
    hstRtcEngine.exit()
    .then(function(){
        addSystemMsg("Exit success.");
    })
    .catch(function(){
        addSystemMsg("Exit failed!");
    });

    onLeaveGroup();

    hstRtcEngine.destroy();    

    updateAppState(0);
    
    onlineUserList.clear();
    updateOnlineUserList();
});

// 鼠标点击“加入分组”按钮处理
$('#join-group-btn').click(function () {
    let groupId = document.getElementById('group-id').value;
    hstRtcEngine.joinGroup(groupId)
    .then(()=> {
        addSystemMsg('Join group ' + groupId + ' success.');
        window.groupId = groupId;
        let userInfo = {
            userId: window.userId,
            pubAudio: false,
            pubVideo: false,
            pubShare: false,
            audioId: "",
            videoId: new Set(),
            shareId: ""
        };
        groupUserList.set(window.userId, userInfo);
        updateGroupUserList();
        updateAppState(3);
    })
    .catch(() => {
        addSystemMsg('Join group failed!')
    })
});

function refreshDataAndUI() {
    for (const panel of videoPanels){
        panel.used = false;
        panel.mediaId = "";
        panel.userId = "";

        $('#user-label-' + panel.index).html("");
        $('#video-label-' + panel.index).html("");
    }

    for (const panel of screenSharePanels) {
        panel.used = false;
        panel.mediaId = "";
        panel.userId = "";

        $('#share-user-label-' + panel.index).html("");
        $('#share-video-label-' + panel.index).html("");
    }

    $('#cam-pub-btn').text("开始广播");
    $('#mic-pub-btn').text("开始广播");
    $('#screen-share-btn').text("开始共享");
}

function onLeaveGroup() {
    stopPublishAllMedia();
    stopRecvAllMedia();

    groupUserList.clear();
    updateGroupUserList();

    refreshDataAndUI();

    updateVideoPanelLayout();
}

// 鼠标点击“离开分组”按钮处理
$("#leave-group-btn").click(function () {
    onLeaveGroup(); // 依赖于groupId，必须在leaveGroup前调用
    
    hstRtcEngine.leaveGroup()
    .then(function(){
        addSystemMsg("Leave group success.");    
    })
    .catch(function(){
        addSystemMsg("Leave group failed!");
    });
    
    updateAppState(2);
});

// 选择摄像头处理
$('#cam-devs-sel').change(function(){
    let options = $('#cam-devs-sel')[0].options;
    let videoPanel = findLocalVideoPanel(options[options.selectedIndex].value);
    if (videoPanel){
        $('#cam-pub-btn').text("停止广播");
    } else {
        $('#cam-pub-btn').text("开始广播");
    }
});

// 点击“开始广播”麦克风设备处理
$('#mic-pub-btn').click(function(){
    let options = $('#mic-devs-sel')[0].options;
    if (options.length <= 0){
        return;
    }

    if (isPublishAudio){
        hstRtcEngine.stopPublishAudio();

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubAudio = false;
        updateGroupUserList();

        isPublishAudio = false;
        $('#mic-pub-btn').text("开始广播");
    } else {
        let micDevId = options[options.selectedIndex].value;
        hstRtcEngine.chooseMicDevice(micDevId);
        hstRtcEngine.startPublishAudio();

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubAudio = true;
        updateGroupUserList();

        isPublishAudio = true;
        $('#mic-pub-btn').text("停止广播");
    }
});

// 点击“开始广播”屏幕共享处理
$('#screen-share-btn').click(function(){
    if (isScreenSharing){ // 停止屏幕共享
        hstRtcEngine.stopScreenShare();
        for (const panel of screenSharePanels){
            if (panel.used && panel.userId == window.userId){
                hstRtcEngine.unsetScreenShareRender(panel.handle);
                panel.used = false;
                panel.userId = "";
                panel.shareId = "";

                $('#share-user-label-' + panel.index).html("");
                $('#share-video-label-' + panel.index).html("");
                break;
            }
        }

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubShare = false;
        updateGroupUserList();

        $('#screen-share-btn').text("开始共享");
        isScreenSharing = false;
    } else { // 开启屏幕共享
        let screenPanel = getAvailableScreenSharePanel();
        if (!screenPanel){
            addSystemMsg("Cannot find available video panel on remote stream add!");
            return;
        }

        screenPanel.used = true;
        screenPanel.userId = window.userId;
        screenPanel.shareId = "0";
        
        hstRtcEngine.setLocalScreenShareRender(screenPanel.handle);
        hstRtcEngine.startScreenShare();
        
        $('#screen-share-btn').text("停止共享");
        isScreenSharing = true;

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubShare = true;
        updateGroupUserList();

        $('#share-user-label-' + screenPanel.index).html(screenPanel.userId);

        displayScreenShareStats(screenPanel);
    }
})

// 点击“开始广播”摄像头处理
$('#cam-pub-btn').click(function(){
    let options = $('#cam-devs-sel')[0].options;
    if (options.length <= 0){
        addSystemMsg("No available camera to broadcast!");
        return;
    }
    
    let index = options.selectedIndex;
    let mediaId = options[index].value;

    let videoPanel = findLocalVideoPanel(mediaId);
    if (videoPanel){ // 停止广播
        videoPanel.used = false;
        videoPanel.videoId = "";
        videoPanel.userId = "";
        videoPanel.audioId = "";
        
        $('#cam-pub-btn').text("开始广播");

        // 清空Video上文字
        $('#user-label-' + videoPanel.index).html("");

        hstRtcEngine.stopPublishVideo(mediaId);
        hstRtcEngine.unsetLocalVideoRender(videoPanel.handle);

        // 更新用户列表广播状态
        let hasLocalVideo = false;
        for (const panel of videoPanels) {
            if (panel.userId === window.userId && panel.used){
                hasLocalVideo = true;
                break;
            }
        }

        // 本地有可能广播了多个摄像头，如果没有广播摄像头，则更新本地摄像头广播状态
        if (!hasLocalVideo){
            groupUserList.get(window.userId).pubVideo = false;
            updateGroupUserList();
        }
    } else { // 开始广播    
        let newVideoPanel = getAvailableVideoPanel();
        if (!newVideoPanel){
            addSystemMsg("Cannot find available video panel!");
            return;
        }

        newVideoPanel.userId = window.userId;
        newVideoPanel.used = true;
        newVideoPanel.videoId = mediaId;

        // Video上显示用户名
        $('#user-label-' + newVideoPanel.index).html(window.userId);

        // 更新广播摄像头按钮显示文字
        $('#cam-pub-btn').text("停止广播");

        // 开启本地预览
        hstRtcEngine.setLocalVideoRender(newVideoPanel.handle, mediaId);
        hstRtcEngine.startPublishVideo(mediaId);

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubVideo = true;
        updateGroupUserList();

        displayStreamStats(newVideoPanel);
    }

    updateVideoPanelLayout();
});

// 点击“发送消息”按钮处理
$('#msg-send-btn').click(function(){
    let sel = $('#msg-send-sel');
    let sendText = $('#msg-send-ta').val();

    if (sendText !== ""){
        let value = $('#msg-send-sel option:selected').val();
        if (value === "everyone"){
            hstRtcEngine.sendGroupMsg({msg: sendText, groupId: window.groupId});
            addLocalGroupMsg(sendText);
        } else {
            hstRtcEngine.sendUserMsg({dstUserId: value, msg: sendText});
            addLocalUserMsg(value, sendText);
        }
        $('#msg-send-ta').val("");
    }
});

////////////////////////////////////////////////////////////////////////////////
// 订阅通知处理
////////////////////////////////////////////////////////////////////////////////


// 远端广播媒体通知
hstRtcEngine.on('onPublishMedia', function (data) {
    let userInfo = groupUserList.get(data.userId);

    if (data.mediaType == 0) { // 屏幕共享
        if (userInfo) {
            if (userInfo.pubShare) {
                console.warn("Already receiving user " + data.userId + "'s screen share!");
                return;
            } else {
                userInfo.pubShare = true;
                userInfo.shareId = data.mediaId;
            }
        }

        hstRtcEngine.startReceiveScreenShare(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Start receive user " + data.userId + " screen share! ");
        })
        .catch(() => {
            addSystemMsg("Receive remote screen share failed!");
        })
    } else if (data.mediaType == 1) { // 音频
        if (userInfo) {
            if (userInfo.pubAudio) {
                console.warn("Already receiving user " + data.userId + "'s audio!");
                return;
            } else {
                userInfo.pubAudio = true;
                userInfo.audioId = data.mediaId;
            }
        }
    
        hstRtcEngine.startReceiveRemoteAudio(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Start receive user " + data.userId + " audio! ");
        })
        .catch(()=>{
            addSystemMsg("Receive remote audio failed!");
        })
    } else if (data.mediaType == 2) { // 视频
        if (userInfo) {
            if (userInfo.videoId.has(data.mediaId)) {
                console.warn("Already receiving user " + data.userId + "'s video!");
                return;
            } else {    
                userInfo.pubVideo = true;
                userInfo.videoId.add(data.mediaId);
            }
        }

        hstRtcEngine.startReceiveRemoteVideo(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Start receive user " + data.userId + " video.");
        })
        .catch(() => {
            addSystemMsg("Receive remote video failed!");
        })
    } else {
        console.log("Invliad media type: ", data.mediaType);
    }

    updateGroupUserList();
});

// 远端取消广播媒体通知
hstRtcEngine.on("onUnPublishMedia", function(data) {
    if (data.mediaType == 0) { // 屏幕共享
        groupUserList.get(data.userId).pubShare = false;
        groupUserList.get(data.userId).shareId = "";

        hstRtcEngine.stopReceiveScreenShare(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Stop receive remote screen share!");
            for (const panel of screenSharePanels){
                if (panel.used && panel.userId === data.userId){
                    hstRtcEngine.unsetScreenShareRender(panel.handle);
                    panel.used = false;
                    panel.userId = "";
                    panel.shareId = "";

                    $('#share-user-label-' + panel.index).html("");
                    $('#share-video-label-' + panel.index).html("");
                    break;
                }
            }
        })
        .catch(() => {
            addSystemMsg("Stop receive remote screen share failed!");
        })
    } else if (data.mediaType == 1) { // 音频
        groupUserList.get(data.userId).pubAudio = false;
        groupUserList.get(data.userId).audioId = "";

        hstRtcEngine.stopReceiveRemoteAudio(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Stop receive remote audio.");
            for (const panel of videoPanels){
                if (panel.used && panel.userId === data.userId 
                    && panel.audioId === data.mediaId) {
                    panel.audioId = "";
                    if (panel.videoId === "") {
                        hstRtcEngine.unsetStreamRender(panel.handle, panel.streamId);
                        panel.used = false;
                        panel.userId = "";
                        panel.streamId = "";
                        $('#user-label-' + panel.index).html("");    
                    }
                    break;
                }
            }
            updateVideoPanelLayout();
        })
        .catch(()=>{
            addSystemMsg("Stop receive remote audio failed!");
        })
    } else if (data.mediaType == 2) { // 视频
        groupUserList.get(data.userId).pubVideo = false;
        groupUserList.get(data.userId).videoId.delete(data.mediaId);

        hstRtcEngine.stopReceiveRemoteVideo(data.userId, data.mediaId)
        .then(() => {
            addSystemMsg("Stop receive remote video!");
            for (const panel of videoPanels){
                if (panel.used && panel.userId === data.userId 
                    && panel.videoId === data.mediaId) {
                    panel.videoId = "";
                    $('#video-label-' + panel.index).html("");
                    if (panel.audioId === "") {
                        hstRtcEngine.unsetStreamRender(panel.handle, panel.streamId);
                        panel.used = false;
                        panel.userId = "";
                        panel.streamId = "";
                        $('#user-label-' + panel.index).html("");
                    }
                    break;
                }
            }
            updateVideoPanelLayout();
        })
        .catch(() => {
            addSystemMsg("Stop receive remote video failed!");
        })
    } else {
        console.log("Invliad media type: ", data.mediaType);
    }

    updateGroupUserList();
});

// 收到用户消息处理（指定用户发送的消息，相当于私聊消息）
hstRtcEngine.on("onRecvUserMsg", function(data) {
    addUserMsg(data.srcUserId, data.msg);
});

// 收到分组消息处理（指定分组发送的消息，相当于广播消息）
hstRtcEngine.on("onRecvGroupMsg", function(data) {
    addGroupMsg(data.srcUserId, data.msg);
});

// 用户在线状态变化通知（上线和下线）
hstRtcEngine.on('onOnlineUserState', function(param) {
    if (param.state == 1) { // 用户上线
        onlineUserList.add(param.userId);
    } else { // 用户下线
        onlineUserList.delete(param.userId);
    }
    updateOnlineUserList();
});

// 收到远端媒体数据通知（开始显示）
hstRtcEngine.on('onRemoteMediaAdd', function (params) {
    if (params.mediaType == 0){ // 屏幕共享
        let screenPanel = getAvailableScreenSharePanel();
        if (!screenPanel){
            addSystemMsg("Cannot find available video panel on remote stream add!");
            return;
        }

        screenPanel.used = true;
        screenPanel.userId = params.userId;
        screenPanel.shareId = params.mediaId;

        $('#share-user-label-' + screenPanel.index).html(screenPanel.userId);
        displayScreenShareStats(screenPanel);
        
        hstRtcEngine.setRemoteScreenShareRender(screenPanel.handle, params.userId, params.mediaId);
    }else if (params.mediaType == 1) {// 音频 
        // 如果已经在接收此用户的视频，streamId相同，不用重复设置render
        let videoPanel = getVideoPanelWithStreamId(params.streamId);
        if (videoPanel) {
            videoPanel.audioId = params.mediaId;
            return; // 这里不再校验userId和是否真的在接收视频
        }

        videoPanel = getAvailableVideoPanel();
        if (!videoPanel){
            addSystemMsg("Cannot find available video panel on remote audio stream add!");
            return;
        }

        videoPanel.used = true;
        videoPanel.userId = params.userId;
        videoPanel.audioId = params.mediaId;
        videoPanel.streamId = params.streamId;
        
        $('#user-label-' + videoPanel.index).html(videoPanel.userId);
        displayStreamStats(videoPanel);

        hstRtcEngine.setStreamRender(videoPanel.handle, params.streamId);

        updateVideoPanelLayout();
    } else if (params.mediaType == 2){ // 视频
        // 如果已经在接收此用户的音频，streamId相同，不用重复设置render
        let videoPanel = getVideoPanelWithStreamId(params.streamId);
        if (videoPanel) {
            videoPanel.videoId = params.mediaId;
            return; // 这里不再校验userId和是否真的在接收音频
        }

        videoPanel = getAvailableVideoPanel();
        if (!videoPanel){
            addSystemMsg("Cannot find available video panel on remote video stream add!");
            return;
        }

        videoPanel.used = true;
        videoPanel.userId = params.userId;
        videoPanel.videoId = params.mediaId;
        videoPanel.streamId = params.streamId;
        
        $('#user-label-' + videoPanel.index).html(videoPanel.userId);
        displayStreamStats(videoPanel);

        hstRtcEngine.setStreamRender(videoPanel.handle, params.streamId);

        updateVideoPanelLayout();
    }
});

// 收到全量分组用户和媒体广播状态通知处理，刚加入分组时推送
hstRtcEngine.on('onGroupUserList', function(users){
    for (const user of users){
        let userInfo = {
            userId: user,
            pubAudio: false,
            pubVideo: false,
            pubShare: false,
            audioId: "",
            videoId: new Set(),
            shareId: ""
        };
        groupUserList.set(user, userInfo);
    }
    updateGroupUserList();
});

// 通知有用户加入分组
hstRtcEngine.on('onUserJoinGroup', function(user){
    let userInfo = {
        userId: user,
        pubAudio: false,
        pubVideo: false,
        pubShare: false,
        audioId: "",
        videoId: new Set(),
        shareId: ""
    };
    groupUserList.set(user, userInfo);
    updateGroupUserList();
    addSystemMsg(user + " join group.");
});

// 通知有用户离开分组
hstRtcEngine.on('onUserLeaveGroup', function(user){
    let userInfo = groupUserList.get(user);
    if (!userInfo) {
        console.warn("User " + user + " leave group but not found!");
        return;
    }

    // 停止接收用户音频
    if (userInfo.pubAudio) {
        hstRtcEngine.stopReceiveRemoteAudio(userInfo.userId, userInfo.audioId)
        .then(() => {
            addSystemMsg("Stop receive remote audio!");
            for (const panel of videoPanels){
                if (panel.userId === userInfo.userId && panel.audioId === userInfo.audioId){
                    panel.audioId = "";
                    if (panel.videoId === "") {
                        hstRtcEngine.unsetStreamRender(panel.streamId);
                        panel.used = false;
                        panel.userId = "";
                        panel.streamId = "";
                        $('#user-label-' + panel.index).html("");
                    }
                    break;
                }
            }
        })
        .catch(()=>{
            addSystemMsg("Stop receive remote audio failed!");
        })
    }

    // 停止接收用户视频
    if (userInfo.pubVideo) {
        for (const mediaId of userInfo.videoId) {
            hstRtcEngine.stopReceiveRemoteVideo(userInfo.userId, mediaId)
            .then(() => {
                addSystemMsg("Stop receive remote video!");
                for (const panel of videoPanels){
                    if (panel.userId === userInfo.userId && panel.videoId === mediaId){
                        panel.videoId = "";
                        $('#video-label-' + panel.index).html("");

                        if (panel.audioId === "") {
                            hstRtcEngine.unsetStreamRender(panel.streamId);
                            panel.used = false;
                            panel.userId = "";
                            panel.streamId = "";
                            $('#user-label-' + panel.index).html("");
                        }
                        break;
                    }
                }
            })
            .catch(() => {
                addSystemMsg("Stop receive remote video failed!");
            })
        }                        
    }
    
    // 停止接收用户屏幕共享
    if (userInfo.pubShare) {
        hstRtcEngine.stopReceiveScreenShare(userInfo.userId, userInfo.shareId)
        .then(() => {
            addSystemMsg("Stop receive remote screen share!");
            for (const panel of screenSharePanels){
                if (panel.userId === userInfo.userId){
                    hstRtcEngine.unsetRemoteScreenShareRender(panel);
                    panel.used = false;
                    panel.userId = "";
                    panel.shareId = "";

                    $('#share-user-label-' + panel.index).html("");
                    $('#share-video-label-' + panel.index).html("");
                    break;
                }
            }
        })
        .catch(() => {
            addSystemMsg("Stop receive remote screen share failed!");
        })
    }

    groupUserList.delete(user);
    updateGroupUserList();

    addSystemMsg(user + " leave group.");
});

// 接收到用户邀请处理
hstRtcEngine.on('onCommingInvite', function(param) {
    let result = confirm("是否接受来自分组ID为" + param.groupId + ", 用户ID为" + param.userId + "的邀请？");
    if (result) { // 接受邀请
        hstRtcEngine.replyInvite({seqId: param.seqId, groupId: param.groupId, operation: 0, extendInfo: ""});
    } else { // 拒绝邀请
        hstRtcEngine.replyInvite({seqId: param.seqId, groupId: param.groupId, operation: 1, extendInfo: ""});
    }
});

// 用户响应邀请处理
hstRtcEngine.on('onInviteReply', function(param){
    if (param.result == 0) {
        alert("用户 " + param.userId + " 接受了邀请!");
    } else {
        alert("用户 " + param.userId + " 拒绝了邀请!");
    }
});

////////////////////////////////////////////////////////////////////////////////
// 辅助函数
////////////////////////////////////////////////////////////////////////////////

// 根据应用状态控制控件的显示
function updateAppState(state) {
    switch (state) {
        case 0: // NONE
            $('#init-btn').css('display', 'inline');
            $('#user-id').css('display', 'none');
            $('#login-btn').css('display', 'none');
            $('#group-id').css('display', 'none');
            $('#join-group-btn').css('display', 'none');
            $('#leave-group-btn').css('display', 'none');
            $('#exit-btn').css('display', 'none');
            break;
        case 1: // INIT
            $('#init-btn').css('display', 'none');
            $('#user-id').css('display', 'inline');
            $('#login-btn').css('display', 'inline');
            $('#group-id').css('display', 'none');
            $('#join-group-btn').css('display', 'none');
            $('#leave-group-btn').css('display', 'none');
            $('#exit-btn').css('display', 'none');
            break;
        case 2: // LOGIN
            $('#init-btn').css('display', 'none');
            $('#user-id').css('display', 'none');
            $('#login-btn').css('display', 'none');
            $('#group-id').css('display', 'inline');
            $('#join-group-btn').css('display', 'inline');
            $('#leave-group-btn').css('display', 'none');
            $('#exit-btn').css('display', 'inline');
            break;
        case 3: // JOIN
            $('#init-btn').css('display', 'none');
            $('#user-id').css('display', 'none');
            $('#login-btn').css('display', 'none');
            $('#group-id').css('display', 'none');
            $('#join-group-btn').css('display', 'none');
            $('#leave-group-btn').css('display', 'inline');
            $('#exit-btn').css('display', 'inline');
            break;
        default:
            console.log("Invalid app state ", state);
    }
}

// 邀请其他用户加入分组
function inviteJoinGroup(userId){
    let inviteParam = {
        seqId: 1,
        groupId: window.groupId,
        calleeInfo: [userId],
        extendInfo: ""
    };
    hstRtcEngine.invite(inviteParam);

    addSystemMsg("Send invite to user " + userId);
}

// 更新在线用户列表
function updateOnlineUserList(){
    $('#online-users-tbl').empty();
    // 表头
    $('#online-users-tbl').append("<tr valign='middle'>");
    $('#online-users-tbl').append("<th width='50%' valign='middle'>User ID</th>");
    $('#online-users-tbl').append("<th width='20%' valign='middle'>状态</th>");
    $('#online-users-tbl').append("<th width='30%' valign='middle'>操作</th>");
    $('#online-users-tbl').append("</tr>");
    // 在线用户
    for (const user of onlineUserList){
        $('#online-users-tbl').append("<tr valign='middle'>");
        if (user !== window.userId) {
            $('#online-users-tbl').append("<td valign='middle' class='user-line'>" + user + "</td>");
        } else {
            $('#online-users-tbl').append("<td valign='middle' class='user-line'>" + user + "(我)</td>");
        }
        $('#online-users-tbl').append("<td valign='middle' class='user-line'>在线</td>");
        if (user !== window.userId) {
            $('#online-users-tbl').append("<td valign='middle' class='user-line'><button class='invite-btn' onclick='inviteJoinGroup(&#39;" + user + "&#39;)'>邀请</button></td>");
        } else {
            $('#online-users-tbl').append("<td valign='middle' class='user-line'></td>");
        }
        $('#online-users-tbl').append("</tr>");
    }
}

// 获取所有在线用户列表
function getOnlineUserList(){
    hstRtcEngine.getOnlineUsers()
    .then (data => {
        for (const user of data.userInfo){
            onlineUserList.add(user.userId);
        }
        updateOnlineUserList();
    })
    .catch(err => {
        console.log("Get online users failed!");
    });
}

// 添加系统消息
function addSystemMsg(msg){
    var curTime = new Date;
    let fullMsg =  curTime.getHours() + 
        ":" + curTime.getMinutes() + 
        ":" + curTime.getSeconds() + 
        " 系统消息：" + "\r\n" + 
        msg + "\r\n\r\n";
    allMsg += fullMsg;
    $('#all-msg-ta').text(allMsg);
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight);
}

// 添加接收的分组广播消息
function addGroupMsg(srcUserId, msg){
    var curTime = new Date;
    let fullMsg =  curTime.getHours() + 
        ":" + curTime.getMinutes() + 
        ":" + curTime.getSeconds() + 
        " " + srcUserId + " 对 所有人 说：" + "\r\n" + 
        msg + "\r\n\r\n";
    allMsg += fullMsg;
    $('#all-msg-ta').text(allMsg);
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight);
}

// 添加发送的分组广播消息
function addLocalGroupMsg(msg){
    var curTime = new Date;
    let fullMsg =  curTime.getHours() + 
        ":" + curTime.getMinutes() + 
        ":" + curTime.getSeconds() + 
        " " + "我 对 所有人 说：" + "\r\n" + 
        msg + "\r\n\r\n";
    allMsg += fullMsg;
    $('#all-msg-ta').text(allMsg);
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight);
}

// 添加接收的用户消息
function addUserMsg(srcUserId, msg){
    var curTime = new Date;
    let fullMsg =  curTime.getHours() + 
        ":" + curTime.getMinutes() + 
        ":" + curTime.getSeconds() + 
        " " + srcUserId + " 对 我 说：" + "\r\n" + 
        msg + "\r\n\r\n";
    allMsg += fullMsg;
    $('#all-msg-ta').text(allMsg);
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight);
}

// 添加发送的用户消息
function addLocalUserMsg(srcUserId, msg){
    var curTime = new Date;
    let fullMsg =  curTime.getHours() + 
        ":" + curTime.getMinutes() + 
        ":" + curTime.getSeconds() + 
        " 我 对 " + srcUserId + " 说：" + "\r\n" + 
        msg + "\r\n\r\n";
    allMsg += fullMsg;
    $('#all-msg-ta').text(allMsg);
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight);
}

// 通过Media ID查找视频Panel
function findLocalVideoPanel(mediaId){
    for (const panel of videoPanels){
        if (panel.videoId === mediaId && panel.userId === window.userId){
            return panel;
        }
    }
    return null;
}

// 停止接收所有音频、视频和屏幕共享
function stopRecvAllMedia() {
    for (const userInfo of groupUserList.values()) {
        if (userInfo.userId === window.userId) {
            continue;
        }

        if (userInfo.pubAudio) {
            hstRtcEngine.stopReceiveRemoteAudio();
        }

        if (userInfo.pubVideo) {
            for (const mediaId of userInfo.videoId) {
                hstRtcEngine.stopReceiveRemoteVideo(userInfo.userId, mediaId);
            }
        }

        if (userInfo.pubShare) {
            hstRtcEngine.stopReceiveScreenShare(userInfo.userId, userInfo.shareId);
        }
    }
}

// 停止广播所有音频、视频和屏幕共享
function stopPublishAllMedia() {
    // 停止广播视频
    for (const panel of videoPanels){
        if (panel.used && panel.userId === window.userId){
            hstRtcEngine.stopPublishVideo(panel.mediaId);
            hstRtcEngine.unsetLocalVideoRender(panel.handle);
        }
    }

    // 停止广播音频
    if (isPublishAudio) {
        hstRtcEngine.stopPublishAudio();
    }

    // 停止屏幕共享
    if (isScreenSharing) {
        hstRtcEngine.stopScreenShare();
    }
}

// 获取可用的视频Panel
function getAvailableVideoPanel(){
    for (const panel of videoPanels){
        if (!panel.used){
            return panel;
        }
    }
    return null;
}

// 获取可用的屏幕共享Panel
function getAvailableScreenSharePanel() {
    for (const panel of screenSharePanels){
        if (!panel.used){
            return panel;
        }
    }
    return null;
}

function displayScreenShareStats(panel) {
    setTimeout(function(){
        if (panel.used) {
            if (panel.shareId) {
                let options = {userId: panel.userId, mediaType: 0, mediaId: panel.shareId}
                let stats = hstRtcEngine.getStats(options);
                if (stats) {
                    let shareInfo = stats.video.width + "*" 
                        + stats.video.height + " " 
                        + stats.video.frameRate + "fps " 
                        + stats.video.bitRate + "kbps";
                    $('#share-video-label-' + panel.index).html(shareInfo);
                } else {
                    console.warn("Get stats failed! ", options);
                }
            }
            displayScreenShareStats(panel);
        } else {
            $('#share-video-label-' + panel.index).html("");
        }
    }, 1000);// 定时调用接口获取统计数据    
}

// 获取接收到的音频、视频、屏幕共享的流统计数据，包括码流、帧率和分辨率
function displayStreamStats(panel){
    setTimeout(function(){
        if (panel.used) {
            if (panel.videoId) {
                let options = {userId: panel.userId, mediaType: 2, mediaId: panel.videoId};
                let stats = hstRtcEngine.getStats(options);
                if (stats) {
                    let videoInfo = stats.video.width + "*" + stats.video.height + " " 
                        + stats.video.frameRate + "fps " 
                        + stats.video.bitRate + "kbps";
                    $('#video-label-' + panel.index).html(videoInfo);
                } else {
                    console.warn("Get stats failed! ", options);
                }
            } else if (panel.audioId) {
                /* TODO: audio */
            }
            displayStreamStats(panel);
        } else {
            $('#video-label-' + panel.index).html("");
        }
    }, 1000);// 定时调用接口获取统计数据
}

// 加载麦克风、扬声器和摄像头设备列表
function loadMediaDevList() {
    hstRtcEngine.getMediaDevices()
    .then((mediaDevs) => {
        for (const dev of mediaDevs.micDevs){
            var item = new Option(dev.devName, dev.devId);
            $('#mic-devs-sel').append(item);
        }

        for (const dev of mediaDevs.spkDevs){
            var item = new Option(dev.devName, dev.devId);
            $('#spk-devs-sel').append(item);
        }

        for (const dev of mediaDevs.camDevs){
            var item = new Option(dev.devName, dev.devId);
            $('#cam-devs-sel').append(item);
        }
    })
    .catch(err => {
        addSystemMsg("Load media device failed!", err);
    });
}

function getVideoPanelWithStreamId(streamId) {
    for (const panel of videoPanels) {
        if (panel.used && panel.streamId === streamId) {
            return panel;
        }
    }
    return null;
}

// 更新分组用户列表
function updateGroupUserList(){
    // 刷新分组用户列表
    $('#group-users-tbl').empty();
    $('#group-users-tbl').append("<tr>");
    $('#group-users-tbl').append("<th valign='middle' width='55%'>User ID</th>");
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Audio</th>");
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Video</th>");
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Share</th>");
    $('#group-users-tbl').append("</tr>");

    for (const user of groupUserList.values()){
        $('#group-users-tbl').append("<tr>");

        if (user.userId === window.userId){
            $('#group-users-tbl').append("<td valign='middle' class='user-line'>" + user.userId + "(我)</td>");
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'>" + user.userId + "</td>");
        }
        
        if (user.pubAudio){
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-btn' /></td>");
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-btn' /></td>");
        }

        if (user.pubVideo){
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-btn' /></td>");
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-btn' /></td>");
        }

        if (user.pubShare){
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-btn' /></td>");
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-btn' /></td>");
        }
        
        $('#group-users-tbl').append("</tr>");
    }

    // 刷新发送消息用户列表
    var sendMsgSel = $('#msg-send-sel');
    sendMsgSel.empty();
    sendMsgSel.append("<option value='everyone'>所有人</option>");
    for (const user of groupUserList.values()){
        if (user.userId !== window.userId) {
            sendMsgSel.append("<option value='" + user.userId + "'>" + user.userId + "</option");
        }
    }
}

// 计算不同布局下VideoPanel的大小和位置
function calcPanelPosAndSize(containerSize, panelCount) {
    let panelParams = [];
    
    switch (panelCount) {
        case 0:
            break; // do nothing
        case 1:
            panelParams.push({
                pos:{
                    left: 0, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width, 
                    height: containerSize.height
                }
            });
            break;
        case 2:
            panelParams.push({
                pos:{
                    left: 0, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width / 2, 
                    height: containerSize.height
                }
            });
            panelParams.push({
                pos:{
                    left: containerSize.width / 2, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width / 2, 
                    height: containerSize.height
                }
            });
            break;

        case 3: // 左1右2
            panelParams.push({
                pos:{
                    left: 0, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width / 2, 
                    height: containerSize.height
                }
            });
            panelParams.push({
                pos:{
                    left: containerSize.width / 2, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width / 2, 
                    height: containerSize.height / 2
                }
            });
            panelParams.push({
                pos:{
                    left: containerSize.width / 2, 
                    top: containerSize.height / 2
                }, 
                size: {
                    width: containerSize.width / 2, 
                    height: containerSize.height / 2
                }
            });
            break;

        case 4: // 四宫格（2行2列）
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                    panelParams.push({
                        pos:{
                            left: j * containerSize.width / 2, 
                            top: i * containerSize.height / 2
                        }, 
                        size: {
                            width: containerSize.width / 2, 
                            height: containerSize.height / 2
                        }
                    });
                }
            }
            break;

        case 5: // 上1下4
            panelParams.push({
                pos:{
                    left: 0, 
                    top: 0
                }, 
                size: {
                    width: containerSize.width, 
                    height: containerSize.height * 2 / 3
                }
            });

            for (let i = 0; i < 4; i++) {
                panelParams.push({
                    pos:{
                        left: i * containerSize.width / 4, 
                        top: containerSize.height * 2 / 3
                    }, 
                    size: {
                        width: containerSize.width / 4, 
                        height: containerSize.height / 3
                    }
                });     
            }
            break;

        case 6: // 六宫格（2行3列）
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 3; j++) {
                    panelParams.push({
                        pos:{
                            left: j * containerSize.width / 3, 
                            top: i * containerSize.height / 2
                        }, 
                        size: {
                            width: containerSize.width / 3, 
                            height: containerSize.height / 2
                        }
                    });
                }
            }
            break;

        default:
            console.error("Invalid params!");
            break;
    }

    return panelParams;
}

// 更新视频显示布局
function updateVideoPanelLayout() {
    // Container size 
    let containerSize = {width: $('#video-top-panel').width(), height: $('#video-top-panel').height()};

    // Video panel count
    let panelCount = 0;
    for (const panel of videoPanels) {
        if (panel.used) {
            panelCount++;
        }
    }
    // Calculate video panel size and position
    let panelParams = calcPanelPosAndSize(containerSize, panelCount);
    
    let paramIndex = 0;
    for (let panel of videoPanels) {
        if (panel.used) {
            $('#video-panel-wrapper-' + panel.index).css("display", "inline");
            $('#video-panel-wrapper-' + panel.index).css("left", panelParams[paramIndex].pos.left);
            $('#video-panel-wrapper-' + panel.index).css("top", panelParams[paramIndex].pos.top);
            $('#video-panel-wrapper-' + panel.index).css("width", panelParams[paramIndex].size.width);
            $('#video-panel-wrapper-' + panel.index).css("height", panelParams[paramIndex].size.height);
            paramIndex++;
        } else {
            $('#video-panel-wrapper-' + panel.index).css("display", "none");
        }    
    }
}
