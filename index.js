////////////////////////////////////////////////////////////////////////////////
// 全局变量声明、定义和初始化
////////////////////////////////////////////////////////////////////////////////
// 分组内聊天消息和系统消息
let allMsg = ""

// 登录信息
let userId = ""
let groupId = ""

// 初始化视频显示区域，固定最多6个显示区域
let videoPanels = []
for (let i = 0; i < 6; i++) {
    videoPanels.push({
        index: i,
        handle: document.getElementById('video-panel-' + i),
        used: false,
        userId: "",
        audioId: "", // audio mediaId
        videoId: "", // video mediaId
        nickName: ""
    })
}

// 初始化屏幕共享显示区域，固定2个显示区域
let screenSharePanels = []
for (let i = 0; i < 2; i++) {
    screenSharePanels.push({
        index: i,
        handle: document.getElementById('screen-share-panel-' + i),
        used: false,
        userId: "",
        shareId: ""
    })
}

// 是否正在广播麦克风设备
let isPublishAudio = false

// 是否正在屏幕共享
let isScreenSharing = false

// 分组用户列表
let groupUserList = new Map()

// 在线用户列表
let onlineUserList = new Map()

// 创建实时音视频引擎
let hstRtcEngine = new HstRtcEngine()

// 媒体设备列表
let camDevList = new Array()
let micDevList = new Array()
let spkDevList = new Array()

// App state
let curAppState = 0

// 当前显示的白板
let curWhiteBoardId = null

// 白板分页信息
let wbPageInfoMap = new Map()

// SDK导出的枚举类型
const MediaType = hstRtcEngine.MediaType
const OnlineType = hstRtcEngine.OnlineType
const DisplayMode = hstRtcEngine.DisplayMode

////////////////////////////////////////////////////////////////////////////////
// 配置数据
////////////////////////////////////////////////////////////////////////////////
// 应用配置
let defaultAppId = '925aa51ebf829d49fc98b2fca5d963bc'
let defaultAppSecret = 'd52be60bb810d17e'
let useUserDefineApp = false
let userDefineAppId = ""
let userDefineAppSecret = ""

// 登录所需的Token
let loginToken = ""

// 服务器配置
let userDefineServerAddr = ""
let useUserDefineServerAddr = false

// 其他配置
let forceLogin = false
let recvMagicAudioMode = 0 // 0:follow, 1:only origin, 2:only magic 
let sendMagicAudioValue = 0

// 音频配置
let curMicDevId = ""
let curSpkDevId = ""

// 视频配置（默认配置）
let useUserDefineVideoSetting = false
let videoWidth = 640
let videoHeight = 480
let videoFrameRate = 15
let videoBitRate = 0

// 屏幕共享配置（默认配置）
let useUserDefineShareSetting = false
let shareWidth = 1920
let shareHeight = 1080
let shareFrameRate = 15
let shareBitRate = 0

// 白板显示模式和参数
let curWbDisplayMode = DisplayMode.DBWZ
let curWbDisplayParam = 100

////////////////////////////////////////////////////////////////////////////////
// 界面初始化
////////////////////////////////////////////////////////////////////////////////
$(function () {
    // 初始化Tab显示状态
    $('#tab1').show()
    $('#tab-btn-0').css("background-color", "rgb(106,125,254)")
    $('#tab2').hide()
    $('#tab3').hide()
    $('#tab4').hide()
    $('#tab5').hide()

    // 功能Tab切换控制
    var btns = $('#tabs button')
    btns.click(function () {
        var clickIndex = parseInt(btns.index(this))
        for (var i = 0; i < btns.length; i++) {
            if (clickIndex == i) {
                $('#tab' + (i + 1)).show()
                btns[i].setAttribute("style", "background-color: rgb(106,125,254); color: white")
            } else {
                $('#tab' + (i + 1)).hide()
                btns[i].setAttribute("style", "background-color: white; color: black")
            }
        }
        updateVideoPanelLayout()
    })

    // 设置Tab切换控制
    $(function() {
        $(".setting-tab-box li").each(function(index) {
            $(this).click(function() {
                // 清除标题焦点
                $("li.active").removeClass("active")
                // 设置标题焦点
                $(this).addClass("active") //注意这里
                // 清除内容焦点
                $(".setting-tab-content div.active-content").removeClass("active-content")
                // 设置内容焦点
                $(".setting-tab-content>div").eq(index).addClass("active-content")
            })
        })
    })

    loadSettings()
    initSettingUI()

    updateGroupUserList()
    updateAppState(0)
    updateVideoPanelLayout()
    updateCurWbDisplayMode()

    fetchLoginToken()

    hstRtcEngine.setSendMagicAudioValue(sendMagicAudioValue)
    hstRtcEngine.setRecvMagicAudioMode(recvMagicAudioMode)
})

////////////////////////////////////////////////////////////////////////////////
// 控件行为定义
////////////////////////////////////////////////////////////////////////////////

$('.whiteboard-menu').on('click', 'button', function (event) {
    var target = $(event.target)
    target.addClass('selected').siblings().removeClass('selected')
    $(`#${target.attr('data-id')}`).show().siblings().hide()
})

$('#app-cfg-cbx').click(function () {
    if ($(this).is(':checked')) {
        $('#app-id-input').removeAttr("disabled")
        $('#app-secret-input').removeAttr("disabled")
        useUserDefineApp = true
    } else {
        $('#app-id-input').attr("disabled", "disabled")
        $('#app-secret-input').attr("disabled", "disabled")
        useUserDefineApp = false
    }
    storeSettings()
})

$('#server-cfg-cbx').click(function () {
    if ($(this).is(':checked')) {
        $('#server-addr-input').removeAttr("disabled")
        useUserDefineServerAddr = true
    } else {
        $('#server-addr-input').attr("disabled", "disabled")
        useUserDefineServerAddr = false
    }
    storeSettings()
})

$('#force-login-cbx').click(function () {
    if ($(this).is(':checked')) {
        forceLogin = true
    } else {
        forceLogin = false
    }
    storeSettings()
})

$('#video-cbx').click(function () {
    if ($(this).is(':checked')) {
        $('#video-resolution-sel').removeAttr("disabled")
        $('#video-framerate-slider').removeAttr("disabled")
        $('#video-bitrate-slider').removeAttr("disabled")
        useUserDefineVideoSetting = true
    } else {
        $('#video-resolution-sel').attr("disabled", "disabled")
        $('#video-framerate-slider').attr("disabled", "disabled")
        $('#video-bitrate-slider').attr("disabled", "disabled")
        useUserDefineVideoSetting = false
    }
    storeSettings()
})

$('#share-cbx').click(function () {
    if ($(this).is(':checked')) {
        $('#share-resolution-sel').removeAttr("disabled")
        $('#share-framerate-slider').removeAttr("disabled")
        $('#share-bitrate-slider').removeAttr("disabled")
        useUserDefineShareSetting = true
    } else {
        $('#share-resolution-sel').attr("disabled", "disabled")
        $('#share-framerate-slider').attr("disabled", "disabled")
        $('#share-bitrate-slider').attr("disabled", "disabled")
        useUserDefineShareSetting = false
    }
    storeSettings()
})

$('#magic-audio-slider').change(function () {
    $('#magic-audio-text').text($(this).val())
    sendMagicAudioValue = parseInt($(this).val())
    storeSettings()
})

$('#video-framerate-slider').change(function () {
    $('#video-framerate-text').text($(this).val())
    videoFrameRate = parseInt($(this).val())
    storeSettings()
})

$('#video-bitrate-slider').change(function () {
    $('#video-bitrate-text').text($(this).val())
    videoBitRate = parseInt($(this).val())
    storeSettings()
})

$('#share-framerate-slider').change(function () {
    $('#share-framerate-text').text($(this).val())
    shareFrameRate = parseInt($(this).val())
    storeSettings()
})

$('#share-bitrate-slider').change(function () {
    $('#share-bitrate-text').text($(this).val())
    shareBitRate = parseInt($(this).val())
    storeSettings()
})

$('#app-id-input').change(function () {
    userDefineAppId = $(this).val()
    storeSettings()
})

$('#app-secret-input').change(function () {
    userDefineAppSecret = $(this).val()
    storeSettings()
})

$('#scale-param-input').change(function () {
    curWbDisplayParam = $(this).val()
    storeSettings()
})

$('#server-addr-input').change(function () {
    userDefineServerAddr = $(this).val()
    storeSettings()
})

$('#scale-param-input').change(function () {
    curWbDisplayParam = parseInt($(this).val())
    storeSettings()
    updateCurWbDisplayParam()
})

$('#recv-magic-sel').change(function () {
    recvMagicAudioMode = $(this).val()
    storeSettings()
})

$('#mic-devs-sel').change(function () {
    curMicDevId = $(this).val()
    storeSettings()
})

$('#spk-devs-sel').change(function () {
    curSpkDevId = $(this).val()
    updateCurSpkDev()
    storeSettings()
})

$('#display-mode-sel').change(function () {
    curWbDisplayMode = $(this).val()
    updateCurWbDisplayMode()
    storeSettings()
})

$('#video-resolution-sel').change(function () {
    [videoWidth, videoHeight] = $(this).val().split('*')
    videoWidth = parseInt(videoWidth)
    videoHeight = parseInt(videoHeight)
    storeSettings()
})

$('#share-resolution-sel').change(function () {
    [shareWidth, shareHeight] = $(this).val().split('*')
    shareWidth = parseInt(shareWidth)
    shareHeight = parseInt(shareHeight)
    storeSettings()
})

// 窗口大小变化的时候，需要刷新VideoPanel布局
$(window).resize(function () {
    updateVideoPanelLayout()
})

$(".video-panel").dblclick(toggleMaxPanel)
$(".screen-share-panel").dblclick(toggleMaxPanel)

// 鼠标点击“初始化”按钮处理
$("#init-btn").click(function () {
    hstRtcEngine.init().then(function () {
        addSystemMsg("Init success.")
        updateAppState(1)
        loadMediaDevList()
    }).catch(function (err) {
        addSystemMsg("Init failed: " + err)
    })
})

// 鼠标点击“登录”按钮处理
$('#login-btn').click(function () {
    let inputUserId = document.getElementById('user-id').value
    let inputNickName = document.getElementById('nick-name').value
    let options = {
        userId: inputUserId,
        forceLogin: forceLogin,
        extendInfo: inputNickName,
        accessUrl: (useUserDefineServerAddr ? userDefineServerAddr : null),
        appId: (useUserDefineApp ? userDefineAppId : defaultAppId),
        companyId: "",
        token: loginToken,
    }
    hstRtcEngine.login(options).then(() => {
        window.userId = inputUserId
        // 登录成功后，应立即获取全量在线用户列表，后续服务器只会通知增量在线用户
        getOnlineUserList()
        updateAppState(2)
        addSystemMsg("Login success.")
    }).catch(() => {
        addSystemMsg("Login failed!")
    })
})

// 鼠标点击“退出登录”按钮处理
$("#logout-btn").click(function () {
    hstRtcEngine.logout().then(function () {
        addSystemMsg("Logout success.")
        window.userId = ""
        onLeaveGroup()

        onlineUserList.clear()
        updateOnlineUserList()

        camDevList = []
        micDevList = []
        spkDevList = []

        updateAppState(0)

        hstRtcEngine.destroy()
    }).catch(function () {
        addSystemMsg("Logout failed!")
    })
})

// 鼠标点击“加入分组”按钮处理
$('#join-group-btn').click(function () {
    let groupId = document.getElementById('group-id').value
    doJoinGroup(groupId)
})

// 鼠标点击“离开分组”按钮处理
$("#leave-group-btn").click(function () {
    doLeaveGroup()
})

// 点击“开始广播”麦克风设备处理
$('#mic-pub-btn').click(function () {
    let options = $('#mic-devs-sel')[0].options
    if (options.length <= 0) {
        alert("None microphone device found!")
        return
    }

    if (isPublishAudio) {
        hstRtcEngine.stopPublishMedia(MediaType.AUDIO)

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubAudio = false
        updateGroupUserList()

        isPublishAudio = false
        $('#mic-pub-btn').css("background-color", "rgb(106,125,254)")

        addSystemMsg("Stop publish audio device " + curMicDevId)
    } else {
        hstRtcEngine.startPublishMedia(MediaType.AUDIO, curMicDevId)
        displayAudioStats(window.userId, curMicDevId)

        // 更新用户列表广播状态
        groupUserList.get(window.userId).pubAudio = true
        updateGroupUserList()

        isPublishAudio = true
        $('#mic-pub-btn').css("background-color", "red")

        addSystemMsg("Start publish audio device " + curMicDevId)
    }
})

// 点击“开始广播”屏幕共享处理
$('#screen-share-btn').click(function () {
    if (isScreenSharing) { // 停止屏幕共享
        stopPublishScreenShare()
    } else { // 开启屏幕共享
        startPublishScreenShare()
    }
})

// 点击“开始广播”摄像头处理
$('#cam-pub-btn').click(function () {
    if ($('#cam-menu').css('display') == "none") {
        showCamMenu()
    } else {
        hideCamMenu()
    }
})

// 点击“发送消息”按钮处理
$('#msg-send-btn').click(function () {
    let sel = $('#msg-send-sel')
    let sendText = $('#msg-send-ta').val()

    if (sendText !== "") {
        let value = $('#msg-send-sel option:selected').val()
        if (value === "everyone") {
            hstRtcEngine.sendGroupMsg({
                msg: sendText,
                groupId: window.groupId
            })
            addLocalGroupMsg(sendText)
        } else {
            hstRtcEngine.sendUserMsg({
                dstUserId: value,
                msg: sendText
            })
            addLocalUserMsg(value, sendText)
        }
        $('#msg-send-ta').val("")
    }
})

// 创建白板
let boardnumber = 1
$('.createBoard').click(() => {
    // let userId = document.getElementById('user-id').value
    let params = {
        board_name:  `${window.userId}:Blank${boardnumber ++}`
    }
    hstRtcEngine.createWhiteBoard(params).then((mediaId) => {
        hstRtcEngine.startPublishMedia(hstRtcEngine.MediaType.WHITE_BOARD, mediaId)
    })
})
// 编辑白板
$('.edit-btn').click(function () {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    let editStatus =  whiteBoard.edit()
    whiteBoard.edit(!editStatus).then((res) => {
        if (res) {
            $(this).text('取消标注')
            $('.btn-group').show()
        } else {
            $(this).text('标注')
            $('.btn-group').hide()
        }
    })
})
// 选择线型
$('.type_btn_group').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    console.log(e.target.dataset)
    let type = e.target.dataset.value
    whiteBoard.toolType(type)
})
// 撤销
$('.revoke_btn').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    whiteBoard.revoke()
})
// 恢复
$('.restore_btn').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    whiteBoard.restore()
})
// 清空
$('.clear_btn').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    whiteBoard.clear()
})

$('.size-btn-group').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    let type = e.target.dataset.value
    whiteBoard.brushSize(type)
})

$('.color-btn-group').click(function (e) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    let type = e.target.dataset.value
    whiteBoard.brushColor(type)
})
$('.close-btn').click(function () {
    hstRtcEngine.closeWhiteBoard(curWhiteBoardId)
})
$('.page-up').click(function () {
    // let pageInfo = wbPageInfoMap.get(curWhiteBoardId)
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    let curPage = whiteBoard.page()
    whiteBoard.page(curPage - 1)
})
$('.page-next').click(function () {
    // let pageInfo = wbPageInfoMap.get(curWhiteBoardId)
    let whiteBoard = hstRtcEngine.getWhiteBoard(curWhiteBoardId)
    let curPage = whiteBoard.page()
    whiteBoard.page(curPage + 1)
})

// 创建文档
$('.createDocBoard').on('click', function () {
    $('.docInput').click()
})
$('.docInput').on('change', function (e) {
    let file = e.target.files[0]
    hstRtcEngine.startUpload({
        file_name: file.name,
        file_size: file.size,
        file: file,
        onStartUpload: () => {
            addSystemMsg("Start upload")
        },
        onStartTransCode: () => {
            addSystemMsg("转码中，请耐心等候...")
        },
        onTransCodeSuccess: (params) => {
            addSystemMsg("转码成功")
            let object = {
                board_name:  params.board_name,
                board_type: 1,
                convert_file_path: params.convert_file_path,
                file_path: params.file_path,
                width: params.width,
                height: params.height,
                page: params.page
            }
            hstRtcEngine.createWhiteBoard(object).then((mediaId) => {
                hstRtcEngine.startPublishMedia(hstRtcEngine.MediaType.WHITE_BOARD, mediaId)
            })
        },
        onFailed: () => {
        }
    })
})



////////////////////////////////////////////////////////////////////////////////
// 订阅事件
////////////////////////////////////////////////////////////////////////////////

// 点击了浏览器弹框的“停止共享”
hstRtcEngine.subEvent('onScreenShareStopped', function(data) {
    stopPublishScreenShare()
})

// 白板翻页通知
hstRtcEngine.subEvent('onWhiteBoardCurPageChanged', function(data) {
    let pageInfo = wbPageInfoMap.get(data.mediaId)
    if (pageInfo) {
        pageInfo.curPage = data.curPage
        if (data.mediaId == curWhiteBoardId) {
            updateWhiteBoardPageInfo(pageInfo)
        }
    }
})

// 远端广播媒体通知
hstRtcEngine.subEvent('onPublishMedia', function (data) {
    if (data.mediaType == MediaType.SCREEN_SHARE) { // 屏幕共享
        onPublishShare(data)
    } else if (data.mediaType == MediaType.AUDIO) { // 音频
        onPublishAudio(data)
    } else if (data.mediaType == MediaType.VIDEO) { // 视频
        onPublishVideo(data)
    } else if (data.mediaType == MediaType.WHITE_BOARD) {
        onPublishBoard(data)
    } else {
        console.log("Invliad media type: ", data.mediaType)
    }
    updateGroupUserList()
})

// 远端取消广播媒体通知
hstRtcEngine.subEvent("onUnPublishMedia", function (data) {
    if (data.mediaType == MediaType.SCREEN_SHARE) { // 屏幕共享
        onUnPublishShare(data)
    } else if (data.mediaType == MediaType.AUDIO) { // 音频
        onUnPublishAduio(data)
    } else if (data.mediaType == MediaType.VIDEO) { // 视频
        onUnPublishVideo(data)
    } else if (data.mediaType == MediaType.WHITE_BOARD) {
        onUnPublishBoard(data)
    } else {
        console.log("Invliad media type: ", data.mediaType)
    }
    updateGroupUserList()
})

// 收到用户消息处理（指定用户发送的消息，相当于私聊消息）
hstRtcEngine.subEvent("onRecvUserMsg", function (data) {
    addUserMsg(data.srcUserId, data.msg)
})

// 收到分组消息处理（指定分组发送的消息，相当于广播消息）
hstRtcEngine.subEvent("onRecvGroupMsg", function (data) {
    addGroupMsg(data.srcUserId, data.msg)
})

// 用户在线状态变化通知（上线和下线）
hstRtcEngine.subEvent('onOnlineUserState', function (params) {
    if (params.state == OnlineType.ONLINE) { // 用户上线
        let userInfo = {
            "mutexType": params.mutexType,
            "state": params.state,
            "customState": params.customState,
            "extendInfo": params.extendInfo
        }
        let onlineInfo = onlineUserList.get(params.userId)
        if (onlineInfo) {
            onlineInfo.push(userInfo)
        } else {
            onlineUserList.set(params.userId, [userInfo])
        }
    } else { // 用户下线
        onlineUserList.delete(params.userId)
    }
    updateOnlineUserList()
})

// 收到远端媒体数据通知（开始显示）
hstRtcEngine.subEvent('onRemoteMediaAdd', function (params) {
    if (params.mediaType == MediaType.SCREEN_SHARE) { // 屏幕共享
        onShareMediaAdd(params)
    } else if (params.mediaType == MediaType.AUDIO) { // 音频 
        onAudioMediaAdd(params)
    } else if (params.mediaType == MediaType.VIDEO) { // 视频
        onVideoMediaAdd(params)
    } else if (params.mediaType == MediaType.WHITE_BOARD) { // 白板
        onBoardMediaAdd(params)
    }
})

// 收到全量分组用户和媒体广播状态通知处理，刚加入分组时推送
hstRtcEngine.subEvent('onGroupUserList', function (users) {
    for (const user of users) {
        let userInfo = {
            userId: user,
            pubAudio: false,
            pubVideo: false,
            pubShare: false,
            pubBoard: false,
            audioId: "",
            videoId: new Set(),
            shareId: "",
            boardId: new Set(),
            nickName: getUserNickName(user)
        }
        groupUserList.set(user, userInfo)
    }
    updateGroupUserList()
})

// 通知有用户加入分组
hstRtcEngine.subEvent('onUserJoinGroup', function (user) {
    let userInfo = {
        userId: user,
        pubAudio: false,
        pubVideo: false,
        pubShare: false,
        pubBoard: false,
        audioId: "",
        videoId: new Set(),
        shareId: "",
        boardId: new Set(),
        nickName: getUserNickName(user)
    }
    groupUserList.set(user, userInfo)
    updateGroupUserList()
    addSystemMsg(user + " join group.")
})

// 通知有用户离开分组
hstRtcEngine.subEvent('onUserLeaveGroup', function (user) {
    let userInfo = groupUserList.get(user)
    if (!userInfo) {
        console.warn("User " + user + " leave group but not found!")
        return
    }

    addSystemMsg(user + " leave group.")

    stopReceiveUserAudio(userInfo)
    stopReceiveUserVideo(userInfo)
    stopReceiveUserShare(userInfo)

    groupUserList.delete(user)
    updateGroupUserList()
})

// 接收到用户邀请处理
hstRtcEngine.subEvent('onCommingInvite', function (param) {
    let result = confirm("是否接受来自分组ID为" + param.groupId + ", 用户ID为" + param.userId + "的邀请？")
    if (result) { // 接受邀请
        hstRtcEngine.replyInvite({
            seqId: param.seqId,
            groupId: param.groupId,
            operation: 0,
            extendInfo: ""
        })
        if (!param.groupId) {
            alert("无效的Group ID！")
            return
        }
        if (window.groupId) { // 已经在分组中
            if (param.groupId === window.groupId) {
                alert("您已经在分组 " + window.groupId + " 中！")
                return
            }
            // 先退出已有分组
            doLeaveGroup()
            // 由于无法得到doLeaveGroup的异步回调结果，这里Sleep几秒钟
            sleep(1000).then(function () {
                doJoinGroup(param.groupId)
            })
        } else { // 没在分组中，直接加入分组
            doJoinGroup(param.groupId)
        }
    } else { // 拒绝邀请
        hstRtcEngine.replyInvite({
            seqId: param.seqId,
            groupId: param.groupId,
            operation: 1,
            extendInfo: ""
        })
    }
})

// 用户响应邀请处理
hstRtcEngine.subEvent('onInviteReply', function (param) {
    if (param.result == 0) {
        alert("用户 " + param.userId + " 接受了邀请!")
    } else {
        alert("用户 " + param.userId + " 拒绝了邀请!")
    }
})

// 用户强制登出处理
hstRtcEngine.subEvent('onUserForceLogout', function () {
    alert("其他用户强制登录，您被被强制登出！")
    window.location.reload()
})

// 被强制踢出
hstRtcEngine.subEvent('onKickOut', function () {
    alert("您被强制踢出，将刷新页面！")
    window.location.reload()
})

////////////////////////////////////////////////////////////////////////////////
// 具体实现函数
////////////////////////////////////////////////////////////////////////////////

// 根据应用状态控制控件的显示
function updateAppState(state) {
    curAppState = state
    switch (curAppState) {
        case 0: // NONE
            $('#init-btn').css('display', 'inline')
            $('#user-tr').css('display', 'none')
            $('#nick-tr').css('display', 'none')
            $('#login-btn').css('display', 'none')
            $('#group-tr').css('display', 'none')
            $('#join-group-btn').css('display', 'none')
            $('#leave-group-btn').css('display', 'none')
            $('#logout-btn').css('display', 'none')
            break
        case 1: // INIT
            $('#init-btn').css('display', 'none')
            $('#user-tr').css('display', 'inline')
            $('#nick-tr').css('display', 'inline')
            $('#login-btn').css('display', 'inline')
            $('#group-tr').css('display', 'none')
            $('#join-group-btn').css('display', 'none')
            $('#leave-group-btn').css('display', 'none')
            $('#logout-btn').css('display', 'none')
            break
        case 2: // LOGIN
            $('#init-btn').css('display', 'none')
            $('#user-tr').css('display', 'none')
            $('#nick-tr').css('display', 'none')
            $('#login-btn').css('display', 'none')
            $('#group-tr').css('display', 'inline')
            $('#join-group-btn').css('display', 'inline')
            $('#leave-group-btn').css('display', 'none')
            $('#logout-btn').css('display', 'inline')
            break
        case 3: // JOIN
            $('#init-btn').css('display', 'none')
            $('#user-tr').css('display', 'none')
            $('#nick-tr').css('display', 'none')
            $('#login-btn').css('display', 'none')
            $('#group-tr').css('display', 'none')
            $('#join-group-btn').css('display', 'none')
            $('#leave-group-btn').css('display', 'inline')
            $('#logout-btn').css('display', 'inline')
            break
        default:
            console.log("Invalid app state ", state)
    }
}

// 邀请其他用户加入分组
function inviteJoinGroup(userId) {
    let inviteParam = {
        seqId: 1,
        groupId: window.groupId,
        calleeInfo: [userId],
        extendInfo: ""
    }
    hstRtcEngine.invite(inviteParam)

    addSystemMsg("Send invite to user " + userId)
}

// 更新在线用户列表
function updateOnlineUserList() {
    $('#online-users-tbl').empty()
    // 表头
    $('#online-users-tbl').append("<tr valign='middle' id='users-table-title-tr'>")
    $('#users-table-title-tr').append("<th width='40%' valign='middle'>User ID</th>")
    $('#users-table-title-tr').append("<th width='20%' valign='middle'>Mutex Type</th>")
    $('#users-table-title-tr').append("<th width='20%' valign='middle'>State</th>")
    $('#users-table-title-tr').append("<th width='20%' valign='middle'>Operation</th>")

    // 在线用户
    onlineUserList.forEach(function(value, key, map) {
        for (const info of value) { // 同一个userId多个mutexType
            let nodeId = 'user-item-' + key + "-" +  info.mutexType
            $('#online-users-tbl').append("<tr valign='middle' id='" + nodeId + "'>")
            if (key !== window.userId) {
                $('#' + nodeId).append("<td valign='middle' class='user-line'>" + key + "</td>")
            } else {
                $('#' + nodeId).append("<td valign='middle' class='user-line'>" + key + "(我)</td>")
            }

            $('#' + nodeId).append("<td valign='middle' class='user-line'>" + info.mutexType + "</td>")

            $('#' + nodeId).append("<td valign='middle' class='user-line'>在线</td>")

            if (key !== window.userId) {
                $('#' + nodeId).append("<td valign='middle' class='user-line'><button disabled='disabled' class='invite-btn' onclick='inviteJoinGroup(" + key + ")'>邀请</button></td>")
            } else {
                $('#' + nodeId).append("<td valign='middle' class='user-line'></td>")
            }
        }
    })

    // 如果当前已经在分组中，要同步改变邀请按钮状态
    if (curAppState === 3) {
        $('.invite-btn').removeAttr("disabled")
        $('.invite-btn').css("background-color", "rgb(106,125,254)")
    }
}

// 获取所有在线用户列表
function getOnlineUserList() {
    hstRtcEngine.getOnlineUsers().then(data => {
        for (const user of data.userInfo) {
            onlineUserList.set(user.userId, user.onlineInfo)
        }
        updateOnlineUserList()
    }).catch(err => {
        console.error("Get online users failed!")
    })
}

// 获取用户昵称
function getUserNickName(userId) {
    let onlineInfo = onlineUserList.get(userId)
    if (onlineInfo) {
        //TODO: 原则上是需要基于mutexType获取昵称
        for (const userInfo of onlineInfo) {
            return userInfo.extendInfo
        }
    }
    return ""
}

// 添加系统消息
function addSystemMsg(msg) {
    var curTime = new Date
    let fullMsg = curTime.getHours() +
        ":" + curTime.getMinutes() +
        ":" + curTime.getSeconds() +
        " 系统消息：" + "\r\n" +
        msg + "\r\n\r\n"
    allMsg += fullMsg
    $('#all-msg-ta').text(allMsg)
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight)
}

// 添加接收的分组广播消息
function addGroupMsg(srcUserId, msg) {
    var curTime = new Date
    let fullMsg = curTime.getHours() +
        ":" + curTime.getMinutes() +
        ":" + curTime.getSeconds() +
        " " + srcUserId + " 对 所有人 说：" + "\r\n" +
        msg + "\r\n\r\n"
    allMsg += fullMsg
    $('#all-msg-ta').text(allMsg)
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight)
}

// 添加发送的分组广播消息
function addLocalGroupMsg(msg) {
    var curTime = new Date
    let fullMsg = curTime.getHours() +
        ":" + curTime.getMinutes() +
        ":" + curTime.getSeconds() +
        " " + "我 对 所有人 说：" + "\r\n" +
        msg + "\r\n\r\n"
    allMsg += fullMsg
    $('#all-msg-ta').text(allMsg)
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight)
}

// 添加接收的用户消息
function addUserMsg(srcUserId, msg) {
    var curTime = new Date
    let fullMsg = curTime.getHours() +
        ":" + curTime.getMinutes() +
        ":" + curTime.getSeconds() +
        " " + srcUserId + " 对 我 说：" + "\r\n" +
        msg + "\r\n\r\n"
    allMsg += fullMsg
    $('#all-msg-ta').text(allMsg)
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight)
}

// 添加发送的用户消息
function addLocalUserMsg(srcUserId, msg) {
    var curTime = new Date
    let fullMsg = curTime.getHours() +
        ":" + curTime.getMinutes() +
        ":" + curTime.getSeconds() +
        " 我 对 " + srcUserId + " 说：" + "\r\n" +
        msg + "\r\n\r\n"
    allMsg += fullMsg
    $('#all-msg-ta').text(allMsg)
    $('#all-msg-ta').scrollTop($('#all-msg-ta')[0].scrollHeight)
}

// 通过Media ID查找视频Panel
function findLocalVideoPanel(mediaId) {
    for (const panel of videoPanels) {
        if (panel.used && panel.videoId === mediaId && panel.userId === window.userId) {
            return panel
        }
    }
    return null
}

// 停止接收所有音频、视频和屏幕共享
function stopRecvAllMedia() {
    for (const userInfo of groupUserList.values()) {
        if (userInfo.userId === window.userId) {
            continue
        }

        if (userInfo.pubAudio) {
            hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.AUDIO, userInfo.audioId)
        }

        if (userInfo.pubVideo) {
            for (const mediaId of userInfo.videoId) {
                hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.VIDEO, mediaId)
            }
        }

        if (userInfo.pubShare) {
            hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.SCREEN_SHARE, userInfo.shareId)
        }

        if (userInfo.pubBoard) {
            for (const mediaId of userInfo.boardId) {
                hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.WHITE_BOARD, mediaId)
            }
        }
    }
}

// 停止广播所有音频、视频和屏幕共享
function stopPublishAllMedia() {
    // 停止广播视频
    for (const panel of videoPanels) {
        if (panel.used && panel.userId === window.userId) {
            hstRtcEngine.stopPublishMedia(MediaType.VIDEO, panel.mediaId)
            hstRtcEngine.unsetMediaRender(window.userId, MediaType.VIDEO, panel.handle)
        }
    }

    // 停止广播屏幕共享
    for (const panel of screenSharePanels) {
        if (panel.used && panel.userId === window.userId) {
            hstRtcEngine.stopPublishMedia(MediaType.SCREEN_SHARE, null)
            hstRtcEngine.unsetMediaRender(window.userId, MediaType.SCREEN_SHARE, panel.handle)
        }
    }

    // 取消摄像头选择
    for (const camera of camDevList) {
        camera.isPub = false
    }

    // 停止广播音频
    if (isPublishAudio) {
        hstRtcEngine.stopPublishMedia(MediaType.AUDIO)
    }
}

// 获取可用的视频Panel
function getAvailableVideoPanel() {
    for (const panel of videoPanels) {
        if (!panel.used) {
            return panel
        }
    }
    return null
}

// 获取可用的屏幕共享Panel
function getAvailableScreenSharePanel() {
    for (const panel of screenSharePanels) {
        if (!panel.used) {
            return panel
        }
    }
    return null
}

// 显示音量
function displayAudioStats(userId, mediaId) {
    hstRtcEngine.getStreamStats({
        userId: userId,
        mediaType: MediaType.AUDIO,
        mediaId: mediaId
    }, function(stats, userData) {
        $('#audio-volume-' + userData).css("height", stats.volume * 4 / 25 + "px")
    }, 100, userId)
}

// 显示屏幕共享统计数据
function displayScreenShareStats(panel) {
    hstRtcEngine.getStreamStats({
        userId: panel.userId,
        mediaType: MediaType.SCREEN_SHARE,
        mediaId: panel.shareId
    }, function(stats, userData) {
        let videoInfo = stats.width + "*" + stats.height + " " +
                        stats.frameRate + "fps " +
                        stats.bitRate + "kbps "
        $('#share-video-label-' + userData).html(videoInfo)
    }, 1000, panel.index)
}

// 显示视频统计数据
function displayVideoStats(panel) {
    hstRtcEngine.getStreamStats({
        userId: panel.userId,
        mediaType: MediaType.VIDEO,
        mediaId: panel.videoId
    }, function(stats, userData) {
        let videoInfo = stats.width + "*" + stats.height + " " +
                        stats.frameRate + "fps " +
                        stats.bitRate + "kbps "
        $('#video-label-' + userData).html(videoInfo)
    }, 1000, panel.index)
}

// 更新当前使用的麦克风设备
function updateCurMicDev() {
    if (curMicDevId) {
        // 有可能保存的curMicDevId是无效的，比如更换了设备
        let micDevExists = false
        for (const dev of micDevList) {
            if (dev.devId === curMicDevId) {
                micDevExists = true
                break
            }
        }

        if (micDevExists) {
            $('#mic-devs-sel').val(curMicDevId)
        } else {
            curMicDevId = $('#mic-devs-sel').val()
            storeSettings()
        }
    } else {
        curMicDevId = $('#mic-devs-sel').val()
        storeSettings()
    }
}

// 更新当前使用的扬声器设备
function updateCurSpkDev() {
    if (curSpkDevId) {
        // 有可能保存的curSpkDevId是无效的，比如更换了设备
        let spkDevExists = false
        for (const dev of spkDevList) {
            if (dev.devId === curSpkDevId) {
                spkDevExists = true
                break
            }
        }

        if (spkDevExists) {
            $('#spk-devs-sel').val(curSpkDevId)
        } else {
            curSpkDevId = $('#spk-devs-sel').val()
            storeSettings()
        }
    } else {
        curSpkDevId = $('#spk-devs-sel').val()
        storeSettings()
    }

    hstRtcEngine.chooseSpkDevice(curSpkDevId)
}

// 加载麦克风、扬声器和摄像头设备列表
function loadMediaDevList() {
    micDevList = []
    spkDevList = []
    camDevList = []

    $('#mic-devs-sel').empty()
    $('#spk-devs-sel').empty()

    hstRtcEngine.getMediaDevices().then((mediaDevs) => {
        console.log(mediaDevs)

        for (const dev of mediaDevs.micDevs) {
            var item = new Option(dev.devName, dev.devId)
            $('#mic-devs-sel').append(item)
            micDevList.push({
                devName: dev.devName,
                devId: dev.devId,
                isPub: false
            })
        }
        updateCurMicDev()

        for (const dev of mediaDevs.spkDevs) {
            var item = new Option(dev.devName, dev.devId)
            $('#spk-devs-sel').append(item)
            spkDevList.push({
                devName: dev.devName,
                devId: dev.devId
            })
        }
        updateCurSpkDev()

        for (const dev of mediaDevs.camDevs) {
            camDevList.push({
                devName: dev.devName,
                devId: dev.devId
            })
        }
    }).catch(err => {
        console.error(err)
        addSystemMsg("Load media device failed!", err)
    })
}

// 通过用户是否广播音频查询Panel
function getVideoPanelByUserAudio(userId) {
    for (const panel of videoPanels) {
        if (panel.used && panel.userId == userId && panel.audioId) {
            return panel
        }
    }
    return null
}

// 通过用户是否广播视频查询Panel
function getVideoPanelByUserVideo(userId) {
    for (const panel of videoPanels) {
        if (panel.used && panel.userId == userId && panel.videoId) {
            return panel
        }
    }
    return null
}


// 更新分组用户列表
function updateGroupUserList() {
    // 刷新分组用户列表
    $('#group-users-tbl').empty()
    $('#group-users-tbl').append("<tr>")
    $('#group-users-tbl').append("<th valign='middle' width='40%'>User ID</th>")
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Audio</th>")
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Video</th>")
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Share</th>")
    $('#group-users-tbl').append("<th valign='middle' width='15%'>Board</th>")
    $('#group-users-tbl').append("</tr>")

    for (const user of groupUserList.values()) {
        $('#group-users-tbl').append("<tr>")

        if (user.userId === window.userId) {
            $('#group-users-tbl').append("<td valign='middle' class='user-line' width='40%'>" + user.userId + "(我)</td>")
        } else {
            if (user.nickName) {
                $('#group-users-tbl').append("<td valign='middle' class='user-line' width='40%'>" + user.userId + "(" + user.nickName + ")" + "</td>")
            } else {
                $('#group-users-tbl').append("<td valign='middle' class='user-line' width='40%'>" + user.userId + "</td>")
            }
        }

        if (user.pubAudio) {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><div class='overlay-audio-volume'><div id='audio-volume-" + user.userId + "' class='audio-volume'></div></div></td>")
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-state-btn' /></td>");
        }

        if (user.pubVideo) {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-state-btn' width='15%'/></td>")
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-state-btn' width='15%'/></td>")
        }

        if (user.pubShare) {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-state-btn' width='15%'/></td>")
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-state-btn' width='15%'/></td>")
        }

        if (user.pubBoard) {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='pub-state-btn' width='15%'/></td>")
        } else {
            $('#group-users-tbl').append("<td valign='middle' class='user-line'><button class='unpub-state-btn' width='15%'/></td>")
        }

        $('#group-users-tbl').append("</tr>")
    }

    // 刷新发送消息用户列表
    var sendMsgSel = $('#msg-send-sel')
    sendMsgSel.empty()
    sendMsgSel.append("<option value='everyone'>所有人</option>")
    for (const user of groupUserList.values()) {
        if (user.userId !== window.userId) {
            sendMsgSel.append("<option value='" + user.userId + "'>" + user.userId + "</option")
        }
    }
}

// 计算不同布局下VideoPanel的大小和位置
function calcPanelPosAndSize(containerSize, panelCount) {
    let panelParams = []

    switch (panelCount) {
        case 0:
            break // do nothing
        case 1:
            panelParams.push({
                pos: {
                    left: 0,
                    top: 0
                },
                size: {
                    width: containerSize.width,
                    height: containerSize.height
                }
            })
            break
        case 2:
            panelParams.push({
                pos: {
                    left: 0,
                    top: 0
                },
                size: {
                    width: containerSize.width / 2,
                    height: containerSize.height
                }
            })
            panelParams.push({
                pos: {
                    left: containerSize.width / 2,
                    top: 0
                },
                size: {
                    width: containerSize.width / 2,
                    height: containerSize.height
                }
            })
            break

        case 3: // 左1右2
            panelParams.push({
                pos: {
                    left: 0,
                    top: 0
                },
                size: {
                    width: containerSize.width / 2,
                    height: containerSize.height
                }
            })
            panelParams.push({
                pos: {
                    left: containerSize.width / 2,
                    top: 0
                },
                size: {
                    width: containerSize.width / 2,
                    height: containerSize.height / 2
                }
            })
            panelParams.push({
                pos: {
                    left: containerSize.width / 2,
                    top: containerSize.height / 2
                },
                size: {
                    width: containerSize.width / 2,
                    height: containerSize.height / 2
                }
            })
            break

        case 4: // 四宫格（2行2列）
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 2; j++) {
                    panelParams.push({
                        pos: {
                            left: j * containerSize.width / 2,
                            top: i * containerSize.height / 2
                        },
                        size: {
                            width: containerSize.width / 2,
                            height: containerSize.height / 2
                        }
                    })
                }
            }
            break

        case 5: // 上1下4
            panelParams.push({
                pos: {
                    left: 0,
                    top: 0
                },
                size: {
                    width: containerSize.width,
                    height: containerSize.height * 2 / 3
                }
            })

            for (let i = 0; i < 4; i++) {
                panelParams.push({
                    pos: {
                        left: i * containerSize.width / 4,
                        top: containerSize.height * 2 / 3
                    },
                    size: {
                        width: containerSize.width / 4,
                        height: containerSize.height / 3
                    }
                })
            }
            break

        case 6: // 六宫格（2行3列）
            for (let i = 0; i < 2; i++) {
                for (let j = 0; j < 3; j++) {
                    panelParams.push({
                        pos: {
                            left: j * containerSize.width / 3,
                            top: i * containerSize.height / 2
                        },
                        size: {
                            width: containerSize.width / 3,
                            height: containerSize.height / 2
                        }
                    })
                }
            }
            break

        default:
            console.error("Invalid params!")
            break
    }

    return panelParams
}

// 更新所有白板的显示参数（缩放比例）
function updateCurWbDisplayParam() {
    hstRtcEngine.setWhiteBoardDisplayMode(
        null, 
        curWbDisplayMode, 
        curWbDisplayParam)
}

// 更新所有白板的显示模式
function updateCurWbDisplayMode() {
    if (curWbDisplayMode == DisplayMode.DBSF) {
        $('#scale-param-div').show()
    } else {
        $('#scale-param-div').hide()
    }

    hstRtcEngine.setWhiteBoardDisplayMode(
        null, 
        curWbDisplayMode, 
        curWbDisplayParam)
}

// 更新视频显示布局
function updateVideoPanelLayout() {
    // Container size 
    let containerSize = {
        width: $('#video-top-panel').width(),
        height: $('#video-top-panel').height()
    }

    // Video panel count
    let panelCount = 0
    for (const panel of videoPanels) {
        if (panel.used && panel.videoId) {
            panelCount++
        }
    }

    // Calculate video panel size and position
    let panelParams = calcPanelPosAndSize(containerSize, panelCount)

    let paramIndex = 0
    for (let panel of videoPanels) {
        if (panel.used && panel.videoId) {
            $('#video-panel-wrapper-' + panel.index).css("display", "inline")
            $('#video-panel-wrapper-' + panel.index).css("left", panelParams[paramIndex].pos.left)
            $('#video-panel-wrapper-' + panel.index).css("top", panelParams[paramIndex].pos.top)
            $('#video-panel-wrapper-' + panel.index).css("width", panelParams[paramIndex].size.width)
            $('#video-panel-wrapper-' + panel.index).css("height", panelParams[paramIndex].size.height)
            paramIndex++
        } else {
            $('#video-panel-wrapper-' + panel.index).css("display", "none")
        }
    }
}

// 更新UI
function refreshDataAndUI() {
    for (const panel of videoPanels) {
        panel.used = false
        panel.mediaId = ""
        panel.userId = ""

        $('#user-label-' + panel.index).html("")
        $('#video-label-' + panel.index).html("")
    }

    for (const panel of screenSharePanels) {
        panel.used = false
        panel.mediaId = ""
        panel.userId = ""

        $('#share-user-label-' + panel.index).html("")
        $('#share-video-label-' + panel.index).html("")
    }

    $('#cam-pub-btn').attr("disabled", "disabled")
    $('#cam-pub-btn').css("background-color", "rgb(193,193,193)")

    $('#mic-pub-btn').attr("disabled", "disabled")
    $('#mic-pub-btn').css("background-color", "rgb(193,193,193)")

    $('#screen-share-btn').attr("disabled", "disabled")
    $('#screen-share-btn').css("background-color", "rgb(193,193,193)")

    $('.invite-btn').attr("disabled", "disabled")
    $('.invite-btn').css("background-color", "rgb(193,193,193)")

    $('#screen-share-btn').text("开始共享")
}

// 离开分组处理
function onLeaveGroup() {
    stopPublishAllMedia()
    stopRecvAllMedia()

    groupUserList.clear()
    updateGroupUserList()

    window.isPublishAudio = false
    window.isScreenSharing = false
    window.groupId = ""
    window.wbPageInfoMap = new Map()

    hideCamMenu()
    refreshDataAndUI()
    updateVideoPanelLayout()

    $('#board-tab-ul').empty()
    $('.board-bottom').hide()
    // $('#page-info-label').html("")
    $('#inner-title').html("好视通云通信MeetingDemo")
}

// 初始化设置界面
function initSettingUI() {
    // App
    if (useUserDefineApp) {
        $('#app-cfg-cbx').attr('checked', useUserDefineApp)
        $('#app-id-input').removeAttr("disabled")
        $('#app-secret-input').removeAttr("disabled")
    }
    $('#app-id-input').val(userDefineAppId)
    $('#app-secret-input').val(userDefineAppSecret)

    // Server Address
    if (useUserDefineServerAddr) {
        $('#server-cfg-cbx').attr('checked', useUserDefineServerAddr)
        $('#server-addr-input').removeAttr("disabled")
    }
    $('#server-addr-input').val(userDefineServerAddr)

    // other
    $('#force-login-cbx').attr('checked', forceLogin)
    $('#recv-magic-sel').val(recvMagicAudioMode)
    $('#magic-audio-slider').val(sendMagicAudioValue)
    $('#magic-audio-text').text(sendMagicAudioValue)

    // Video
    if (useUserDefineVideoSetting) {
        $('#video-cbx').attr('checked', useUserDefineVideoSetting)
        $('#video-resolution-sel').removeAttr("disabled")
        $('#video-framerate-slider').removeAttr("disabled")
        $('#video-bitrate-slider').removeAttr("disabled")
    }
    $('#video-framerate-slider').val(videoFrameRate)
    $('#video-framerate-text').text(videoFrameRate)
    $('#video-bitrate-slider').val(videoBitRate)
    $('#video-bitrate-text').text(videoBitRate)
    $('#video-resolution-sel').val(videoWidth + "*" + videoHeight)

    // Screen share
    if (useUserDefineShareSetting) {
        $('#share-cbx').attr('checked', useUserDefineShareSetting)
        $('#share-resolution-sel').removeAttr("disabled")
        $('#share-framerate-slider').removeAttr("disabled")
        $('#share-bitrate-slider').removeAttr("disabled")
    }
    $('#share-framerate-slider').val(shareFrameRate)
    $('#share-framerate-text').text(shareFrameRate)
    $('#share-bitrate-slider').val(shareBitRate)
    $('#share-bitrate-text').text(shareBitRate)
    $('#share-resolution-sel').val(shareWidth + "*" + shareHeight)

    // White board
    $('#display-mode-sel').val(curWbDisplayMode)
    $('#scale-param-input').val(curWbDisplayParam)
}

// 隐藏摄像头选择菜单
function hideCamMenu() {
    $('#cam-menu').css('display', "none")
    $('#cam-menu-table').empty()
}

// 弹出摄像头选择菜单
function showCamMenu() {
    $('#cam-menu').css('display', "block")
    $('#cam-menu').css('width', "400px")
    $('#cam-menu').css('z-index', 100)

    // 填充菜单项
    for (const dev of camDevList) {
        if (dev.isPub) {
            $('#cam-menu-table').append("<tr><td align='left'><input type='checkbox' class='cam-menu-cbx' checked='true' value='" + dev.devId + "'>" + dev.devName + "</td></tr>")
        } else {
            $('#cam-menu-table').append("<tr><td align='left'><input type='checkbox' class='cam-menu-cbx' value='" + dev.devId + "'>" + dev.devName + "</td></tr>")
        }
    }

    // 调整菜单显示位置
    $('#cam-menu').css('left', $('#cam-pub-btn').position().left)
    $('#cam-menu').css('top', $('#cam-pub-btn').position().top - $('#cam-menu').height())

    // 单击checkbox处理
    $('.cam-menu-cbx').click(function () {
        if ($(this).is(':checked')) { // 开始广播
            for (const dev of camDevList) {
                if (dev.devId == $(this).val()) {
                    dev.isPub = true
                    startPubLocalCam(dev.devId)
                    break
                }
            }
        } else { // 停止广播
            for (const dev of camDevList) {
                if (dev.devId == $(this).val()) {
                    dev.isPub = false
                    stopPubLocalCam(dev.devId)
                    break
                }
            }
        }
        hideCamMenu()
        updateCamPubBtnState()
    })
}

// 更新广播视频按钮状态
function updateCamPubBtnState() {
    let hasPubCam = false
    for (const dev of camDevList) {
        if (dev.isPub) {
            hasPubCam = true
            break
        }
    }

    if (hasPubCam) {
        $('#cam-pub-btn').css('background-color', 'red')
    } else {
        $('#cam-pub-btn').css('background-color', 'rgb(106,125,254)')
    }
}

// 停止广播本地摄像头
function stopPubLocalCam(mediaId) {
    let videoPanel = findLocalVideoPanel(mediaId)
    if (!videoPanel) {
        console.error("Find local video panel failed while to stop publish!", mediaId)
        return
    }

    videoPanel.used = false
    videoPanel.videoId = ""
    videoPanel.userId = ""
    videoPanel.audioId = ""

    // 清空Video上文字
    $('#user-label-' + videoPanel.index).html("")

    hstRtcEngine.stopPublishMedia(MediaType.VIDEO, mediaId)
    hstRtcEngine.unsetMediaRender(window.userId, MediaType.VIDEO, videoPanel.handle)

    // 更新用户列表广播状态
    let hasLocalVideo = false
    for (const panel of videoPanels) {
        if (panel.userId === window.userId && panel.used) {
            hasLocalVideo = true
            break
        }
    }

    // 本地有可能广播了多个摄像头，如果没有广播摄像头，则更新本地摄像头广播状态
    if (!hasLocalVideo) {
        groupUserList.get(window.userId).pubVideo = false
        updateGroupUserList()
    }

    updateVideoPanelLayout()

    addSystemMsg("Stop publish local camera " + mediaId)
}

// 开始广播本地摄像头
function startPubLocalCam(mediaId) {
    let videoPanel = findLocalVideoPanel(mediaId)
    if (videoPanel) {
        console.error("Camera " + mediaId + " is publishing!")
        return
    }

    let newVideoPanel = getAvailableVideoPanel()
    if (!newVideoPanel) {
        addSystemMsg("Cannot find available video panel!")
        return
    }

    newVideoPanel.userId = window.userId
    newVideoPanel.used = true
    newVideoPanel.videoId = mediaId

    // Video上显示用户名
    $('#user-label-' + newVideoPanel.index).html(window.userId)

    // 广播本地视频
    if (useUserDefineVideoSetting) {
        let options = {
            width: videoWidth,
            height: videoHeight,
            frameRate: videoFrameRate,
            bitRate: videoBitRate
        }
        hstRtcEngine.startPublishMedia(MediaType.VIDEO, mediaId, options)
    } else {
        hstRtcEngine.startPublishMedia(MediaType.VIDEO, mediaId)
    }

    // 开启本地预览
    hstRtcEngine.setMediaRender(window.userId, MediaType.VIDEO, mediaId, newVideoPanel.handle)

    // 更新用户列表广播状态
    groupUserList.get(window.userId).pubVideo = true
    updateGroupUserList()

    displayVideoStats(newVideoPanel)

    updateVideoPanelLayout()

    addSystemMsg("Start publish local camera " + mediaId)
}

// 从localStorage加载设置
function loadSettings() {
    // App
    if (localStorage.getItem("useUserDefineApp")) {
        useUserDefineApp = eval(localStorage.getItem("useUserDefineApp"))
    }
    if (localStorage.getItem("userDefineAppId")) {
        userDefineAppId = localStorage.getItem("userDefineAppId")
    }
    if (localStorage.getItem("userDefineAppSecret")) {
        userDefineAppSecret = localStorage.getItem("userDefineAppSecret")
    }

    // Server
    if (localStorage.getItem("useUserDefineServerAddr")) {
        useUserDefineServerAddr = eval(localStorage.getItem("useUserDefineServerAddr"))
    }
    if (localStorage.getItem("userDefineServerAddr")) {
        userDefineServerAddr = localStorage.getItem("userDefineServerAddr")
    }

    // other
    forceLogin = (localStorage.getItem("forceLogin") == "true")
    if (localStorage.getItem("recvMagicAudioMode")) {
        recvMagicAudioMode = localStorage.getItem("recvMagicAudioMode")
    }
    if (localStorage.getItem("sendMagicAudioValue")) {
        sendMagicAudioValue = parseInt(localStorage.getItem("sendMagicAudioValue"))
    }
    
    // Audio
    if (localStorage.getItem("curMicDevId")) {
        curMicDevId = localStorage.getItem("curMicDevId")
    }
    if (localStorage.getItem("curSpkDevId")) {
        curSpkDevId = localStorage.getItem("curSpkDevId")
    }

    // Video
    if (localStorage.getItem("useUserDefineVideoSetting")) {
        useUserDefineVideoSetting = eval(localStorage.getItem("useUserDefineVideoSetting"))
    }
    if (localStorage.getItem("videoWidth")) {
        videoWidth = parseInt(localStorage.getItem("videoWidth"))
    }
    if (localStorage.getItem("videoHeight")) {
        videoHeight = parseInt(localStorage.getItem("videoHeight"))
    }
    if (localStorage.getItem("videoFrameRate")) {
        videoFrameRate = parseInt(localStorage.getItem("videoFrameRate"))
    }
    if (localStorage.getItem("videoBitRate")) {
        videoBitRate = parseInt(localStorage.getItem("videoBitRate"))
    }

    // Screen share
    if (localStorage.getItem("useUserDefineShareSetting")) {
        useUserDefineShareSetting = eval(localStorage.getItem("useUserDefineShareSetting"))
    }
    if (localStorage.getItem("shareWidth")) {
        shareWidth = parseInt(localStorage.getItem("shareWidth"))
    }
    if (localStorage.getItem("shareHeight")) {
        shareHeight = parseInt(localStorage.getItem("shareHeight"))
    }
    if (localStorage.getItem("shareFrameRate")) {
        shareFrameRate = parseInt(localStorage.getItem("shareFrameRate"))
    }
    if (localStorage.getItem("shareBitRate")) {
        shareBitRate = parseInt(localStorage.getItem("shareBitRate"))
    }

    // White board
    if (localStorage.getItem("curWbDisplayMode")) {
        curWbDisplayMode = parseInt(localStorage.getItem("curWbDisplayMode"))
    }
    if (localStorage.getItem("curWbDisplayParam")) {
        curWbDisplayParam = parseInt(localStorage.getItem("curWbDisplayParam"))
    }
}

// 保存设置数据到localStorage
function storeSettings() {
    localStorage.setItem("useUserDefineApp", useUserDefineApp)
    localStorage.setItem("userDefineAppId", userDefineAppId)
    localStorage.setItem("userDefineAppSecret", userDefineAppSecret)

    localStorage.setItem("useUserDefineServerAddr", useUserDefineServerAddr)
    localStorage.setItem("userDefineServerAddr", userDefineServerAddr)

    localStorage.setItem("forceLogin", forceLogin)
    localStorage.setItem("recvMagicAudioMode", recvMagicAudioMode)
    localStorage.setItem("sendMagicAudioValue", sendMagicAudioValue)

    // Audio
    localStorage.setItem("curMicDevId", curMicDevId)
    localStorage.setItem("curSpkDevId", curSpkDevId)

    // Video
    localStorage.setItem("useUserDefineVideoSetting", useUserDefineVideoSetting)
    localStorage.setItem("videoWidth", videoWidth)
    localStorage.setItem("videoHeight", videoHeight)
    localStorage.setItem("videoFrameRate", videoFrameRate)
    localStorage.setItem("videoBitRate", videoBitRate)

    // Screen share
    localStorage.setItem("useUserDefineShareSetting", useUserDefineShareSetting)
    localStorage.setItem("shareWidth", shareWidth)
    localStorage.setItem("shareHeight", shareHeight)
    localStorage.setItem("shareFrameRate", shareFrameRate)
    localStorage.setItem("shareBitRate", shareBitRate)

    // White board
    localStorage.setItem("curWbDisplayMode", curWbDisplayMode)
    localStorage.setItem("curWbDisplayParam", curWbDisplayParam)
}

// 睡眠
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 处理加入分组
function doJoinGroup(groupId) {
    hstRtcEngine.joinGroup(groupId).then(() => {
        addSystemMsg('Join group ' + groupId + ' success.')
        window.groupId = groupId
        let userInfo = {
            userId: window.userId,
            pubAudio: false,
            pubVideo: false,
            pubShare: false,
            pubBoard: false,
            audioId: "",
            videoId: new Set(),
            boardId: new Set(),
            shareId: ""
        }
        groupUserList.set(window.userId, userInfo)
        updateGroupUserList()
        updateAppState(3)

        $('#mic-pub-btn').removeAttr("disabled")
        $('#cam-pub-btn').removeAttr("disabled")
        $('#screen-share-btn').removeAttr("disabled")

        $('#mic-pub-btn').css("background-color", "rgb(106,125,254)")
        $('#cam-pub-btn').css("background-color", "rgb(106,125,254)")
        $('#screen-share-btn').css("background-color", "rgb(106,125,254)")

        $('.createBoard').css("background-color", "rgb(106,125,254)")
        $('.createDocBoard').css("background-color", "rgb(106,125,254)")

        $('.invite-btn').removeAttr("disabled")
        $('.invite-btn').css("background-color", "rgb(106,125,254)")

        $('#inner-title').html("Group ID：" + groupId + " | " + " User ID：" + window.userId)
    }).catch(() => {
        addSystemMsg('Join group failed!')
    })
}

// 处理离开分组
function doLeaveGroup() {
    onLeaveGroup() // 依赖于groupId，必须在leaveGroup前调用

    hstRtcEngine.leaveGroup().then(function () {
        addSystemMsg("Leave group success.")
    }).catch(function () {
        addSystemMsg("Leave group failed!")
    })

    updateAppState(2)
}

// 获取登录token（测试和Demo使用）
function fetchLoginToken() {
    let appInfo = {
        appId: useUserDefineApp ? userDefineAppId : defaultAppId,
        appSecret: useUserDefineApp ? userDefineAppSecret : defaultAppSecret
    }

    try {
        fetch('https://paas-token-gen.haoshitong.com/generate/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(appInfo),
            credentials: 'omit'
        }).then(function (resp) {
            resp.json().then(function (body) {
                if (body.code == '0') {
                    loginToken = body.result
                } else {
                    console.error("Fetch token return error ", body.code)
                }
            }).catch(function (e) {
                console.error("Invalid response object! ", e)
            })
        }).catch(function (e) {
            console.error("Fetch login token failed! ", e)
        })
    } catch (e) {
        console.error("Fetch login token failed! ", e)
    }
}
// 初始化工具栏 

function initBoardTools (mediaId) {
    let whiteBoard = hstRtcEngine.getWhiteBoard(mediaId)
    let editStatus =  whiteBoard.edit()
    $('.board-bottom').show()
    if (editStatus) {
        $('.edit-btn').show().text('取消标注')
        $('.btn-group').show()
    } else {
        $('.edit-btn').show().text('标注')
        $('.btn-group').hide()
    }
}
// 更新白板翻页信息
function updateWhiteBoardPageInfo(params) {
    // let pageInfoLabel = document.getElementById('page-info-label')
    $('.curPage').text(params.curPage + 1)
    // pageInfoLabel.innerText = "第" + (params.curPage + 1) + "页 / 共" + params.totalPage + "页"
}

// 收到共享数据处理
function onShareMediaAdd(params) {
    let screenPanel = getAvailableScreenSharePanel()
    if (!screenPanel) {
        addSystemMsg("Cannot find available video panel on remote stream add!")
    } else {
        screenPanel.used = true
        screenPanel.userId = params.userId
        screenPanel.shareId = params.mediaId
        $('#share-user-label-' + screenPanel.index).html(screenPanel.userId)
        displayScreenShareStats(screenPanel)
        hstRtcEngine.setMediaRender(params.userId, MediaType.SCREEN_SHARE, params.mediaId, screenPanel.handle, null)
    }
}

// 收到音频数据处理
function onAudioMediaAdd(params) {
    // 如果已经在接收此用户的视频，不用重复设置render
    let videoPanel = getVideoPanelByUserVideo(params.userId)
    if (videoPanel) {
        videoPanel.audioId = params.mediaId
        displayAudioStats(params.userId, params.mediaId) 
    } else {
        videoPanel = getAvailableVideoPanel()
        if (videoPanel) {
            videoPanel.used = true
            videoPanel.userId = params.userId
            videoPanel.audioId = params.mediaId
            hstRtcEngine.setMediaRender(params.userId, MediaType.AUDIO, params.mediaId, videoPanel.handle)
            updateVideoPanelLayout()
            displayAudioStats(params.userId, params.mediaId) 
        } else {
            addSystemMsg("Cannot find available video panel on remote audio stream add!")
        }
    }
}

// 收到视频数据处理
function onVideoMediaAdd(params) {
    // 如果已经在接收此用户的音频，不用重复设置render
    let videoPanel = getVideoPanelByUserAudio(params.userId)
    if (!videoPanel) {
        videoPanel = getAvailableVideoPanel()
        if (!videoPanel) {
            addSystemMsg("Cannot find available video panel on remote video stream add!")
            return
        }
    }

    videoPanel.used = true
    videoPanel.userId = params.userId
    videoPanel.videoId = params.mediaId
    videoPanel.nickName = getUserNickName(params.userId)

    $('#user-label-' + videoPanel.index).html(videoPanel.nickName ? videoPanel.nickName : videoPanel.userId)

    displayVideoStats(videoPanel)
    hstRtcEngine.setMediaRender(params.userId, MediaType.VIDEO, params.mediaId, videoPanel.handle)
    updateVideoPanelLayout()
}

// 收到白板数据处理
function onBoardMediaAdd(params) {
    let boardTab = document.createElement('li')
    boardTab.innerText = params.mediaName
    boardTab.id = params.mediaId
    $('#board-tab-ul').append(boardTab)

    initBoardTools(params.mediaId)

    wbPageInfoMap.set(params.mediaId, {
        totalPage: params.totalPage, 
        curPage: params.curPage})
    
    boardTab.onclick = function() {
        // 清除焦点
        $(".board-tab-box li").css("background-color", "white")
        $(".board-tab-box li").css("color", "black")

        // 重新设置焦点
        $(this).css("background-color", "rgb(106,125,254)")
        $(this).css("color", "white")

        // 因为只有一个白板显示区域，先删除上一个白板
        if (curWhiteBoardId) {
            hstRtcEngine.unsetMediaRender(
                null,
                MediaType.WHITE_BOARD,
                curWhiteBoardId)
            curWhiteBoardId = null
        }

        // 再显示点击的白板
        hstRtcEngine.setMediaRender(
            null, 
            MediaType.WHITE_BOARD, 
            this.id, 
            document.getElementById("board-content-panel"))

        curWhiteBoardId = this.id // 更新当前正在显示的白板
        initBoardTools(params.mediaId) // 更新工具栏
        updateWhiteBoardPageInfo(wbPageInfoMap.get(this.id), this.id) // 显示分页信息
    }

    // 模拟用户点击白板tab
    setTimeout(()=>{boardTab.click()}, 100)
}

// 停止广播屏幕共享
function stopPublishScreenShare() {
    hstRtcEngine.stopPublishMedia(MediaType.SCREEN_SHARE, null)
    for (const panel of screenSharePanels) {
        if (panel.used && panel.userId == window.userId) {
            hstRtcEngine.unsetMediaRender(window.userId, MediaType.SCREEN_SHARE, panel.handle)
            panel.used = false
            panel.userId = ""
            panel.shareId = ""

            $('#share-user-label-' + panel.index).html("")
            $('#share-video-label-' + panel.index).html("")
            break
        }
    }

    // 更新用户列表广播状态
    groupUserList.get(window.userId).pubShare = false
    updateGroupUserList()

    $('#screen-share-btn').text("开始共享")
    isScreenSharing = false

    addSystemMsg("Stop publish screen share.")
}

// 开始广播屏幕共享
function startPublishScreenShare() {
    let screenPanel = getAvailableScreenSharePanel()
    if (!screenPanel) {
        addSystemMsg("Cannot find available video panel on remote stream add!")
        return
    }

    screenPanel.used = true
    screenPanel.userId = window.userId
    screenPanel.shareId = "0"

    if (useUserDefineShareSetting) {
        let options = {
            width: shareWidth,
            height: shareHeight,
            frameRate: shareFrameRate,
            bitRate: shareBitRate
        }
        hstRtcEngine.startPublishMedia(MediaType.SCREEN_SHARE, null, options)
    } else {
        hstRtcEngine.startPublishMedia(MediaType.SCREEN_SHARE, null)
    }

    hstRtcEngine.setMediaRender(window.userId, MediaType.SCREEN_SHARE, null, screenPanel.handle, null)

    $('#screen-share-btn').text("停止共享")
    isScreenSharing = true

    // 更新用户列表广播状态
    groupUserList.get(window.userId).pubShare = true
    updateGroupUserList()

    $('#share-user-label-' + screenPanel.index).html(screenPanel.userId)

    displayScreenShareStats(screenPanel)

    addSystemMsg("Start publish screen share.")
}

// 收到广播屏幕共享消息处理
function onPublishShare(data) {
    let userInfo = groupUserList.get(data.userId)
    if (userInfo) {
        if (userInfo.pubShare) {
            console.warn("Already receiving user " + data.userId + "'s screen share!")
            return
        } else {
            userInfo.pubShare = true
            userInfo.shareId = data.mediaId
        }
    }
    hstRtcEngine.startReceiveMedia(data.userId, MediaType.SCREEN_SHARE, data.mediaId).then(() => {
        addSystemMsg("Start receive user " + data.userId + " screen share! ")
    }).catch(() => {
        addSystemMsg("Receive remote screen share failed!")
    })
}

// 收到广播音频消息处理
function onPublishAudio(data) {
    let userInfo = groupUserList.get(data.userId)
    if (userInfo) {
        if (userInfo.pubAudio) {
            console.warn("Already receiving user " + data.userId + "'s audio!")
            return
        } else {
            userInfo.pubAudio = true
            userInfo.audioId = data.mediaId
        }
    }
    hstRtcEngine.startReceiveMedia(data.userId, MediaType.AUDIO, data.mediaId).then(() => {
        addSystemMsg("Start receive user " + data.userId + " audio! ")
    }).catch(() => {
        addSystemMsg("Receive remote audio failed!")
    })
}

// 收到广播视频消息处理
function onPublishVideo(data) {
    let userInfo = groupUserList.get(data.userId)
    if (userInfo) {
        if (userInfo.videoId.has(data.mediaId)) {
            console.warn("Already receiving user " + data.userId + "'s video!")
            return
        } else {
            userInfo.pubVideo = true
            userInfo.videoId.add(data.mediaId)
        }
    }
    hstRtcEngine.startReceiveMedia(data.userId, MediaType.VIDEO, data.mediaId).then(() => {
        addSystemMsg("Start receive user " + data.userId + " video.")
    }).catch(() => {
        addSystemMsg("Receive remote video failed!")
    })
}

// 收到广播白板消息处理
function onPublishBoard(data) {
    let userInfo = groupUserList.get(data.userId)
    if (userInfo) {
        if (userInfo.boardId.has(data.mediaId)) {
            console.warn("Already receiving user " + data.userId + "'s white board!")
            return
        } else {
            userInfo.pubBoard = true
            userInfo.boardId.add(data.mediaId)
        }
    }
    hstRtcEngine.startReceiveMedia(data.userId, MediaType.WHITE_BOARD, data.mediaId).then(() => {
        addSystemMsg("Start receive white board " + data.mediaId)
    }).catch(() => {
        addSystemMsg("Receive white board " + data.mediaId +" failed!")
    })
}

// 收到停止广播屏幕共享消息处理
function onUnPublishShare(data) {
    groupUserList.get(data.userId).pubShare = false
    groupUserList.get(data.userId).shareId = ""

    hstRtcEngine.stopReceiveMedia(data.userId, MediaType.SCREEN_SHARE, data.mediaId).then(() => {
        addSystemMsg("Stop receive remote screen share!")
        for (const panel of screenSharePanels) {
            if (panel.used && panel.userId === data.userId) {
                hstRtcEngine.unsetMediaRender(panel.userId, MediaType.SCREEN_SHARE, panel.handle)
                panel.used = false
                panel.userId = ""
                panel.shareId = ""

                $('#share-user-label-' + panel.index).html("")
                $('#share-video-label-' + panel.index).html("")
                break
            }
        }
    }).catch(() => {
        addSystemMsg("Stop receive remote screen share failed!")
    })
}

// 收到停止广播音频消息处理
function onUnPublishAduio(data) {
    groupUserList.get(data.userId).pubAudio = false
    groupUserList.get(data.userId).audioId = ""

    hstRtcEngine.stopReceiveMedia(data.userId, MediaType.AUDIO, data.mediaId).then(() => {
        addSystemMsg("Stop receive remote audio.")
        for (const panel of videoPanels) {
            if (panel.used && panel.userId === data.userId &&
                panel.audioId === data.mediaId) {
                panel.audioId = ""
                if (panel.videoId === "") {
                    hstRtcEngine.unsetMediaRender(panel.userId, MediaType.AUDIO, panel.handle)
                    panel.used = false
                    panel.userId = ""
                    $('#user-label-' + panel.index).html("")
                }
                break
            }
        }
        updateVideoPanelLayout()
    }).catch((e) => {
        addSystemMsg("Stop receive remote audio failed!")
    })
}

// 收到停止广播视频消息处理
function onUnPublishVideo(data) {
    groupUserList.get(data.userId).videoId.delete(data.mediaId)
    if (groupUserList.get(data.userId).videoId.size == 0) {
        groupUserList.get(data.userId).pubVideo = false
    }

    hstRtcEngine.stopReceiveMedia(data.userId, MediaType.VIDEO, data.mediaId).then(() => {
        addSystemMsg("Stop receive video " + data.mediaId)
        for (const panel of videoPanels) {
            if (panel.used && panel.userId === data.userId &&
                panel.videoId === data.mediaId) {
                panel.videoId = ""
                $('#video-label-' + panel.index).html("")
                if (panel.audioId === "") {
                    hstRtcEngine.unsetMediaRender(panel.userId, MediaType.VIDEO, panel.handle)
                    panel.used = false
                    panel.userId = ""
                    $('#user-label-' + panel.index).html("")
                }
                break
            }
        }
        updateVideoPanelLayout()
    }).catch((e) => {
        addSystemMsg("Stop receive video " + data.mediaId + " failed!")
        console.error(e)
    })
}

// 收到停止广播白板消息处理
function onUnPublishBoard(data) {
    groupUserList.get(data.userId).boardId.delete(data.mediaId)
    if (groupUserList.get(data.userId).boardId.size == 0) {
        groupUserList.get(data.userId).pubBoard = false
        // 工具栏隐藏
        $('.board-bottom').hide()
    }

    hstRtcEngine.stopReceiveMedia(data.userId, MediaType.WHITE_BOARD, data.mediaId).then(() => {
        addSystemMsg("Stop receive white board " + data.mediaId)
        hstRtcEngine.unsetMediaRender(null, MediaType.WHITE_BOARD, data.mediaId)
        $('#' + data.mediaId).remove()
        if (curWhiteBoardId == data.mediaId) {
            $('#page-info-label').html("")
        }
    }).catch((e)=>{
        addSystemMsg("Stop receive white board " + data.mediaId +" failed!")
        console.error(e)
    })
}

// 停止接收用户音频
function stopReceiveUserAudio(userInfo) {
    if (!userInfo.pubAudio) return

    hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.AUDIO, userInfo.audioId).then(() => {
        addSystemMsg("Stop receive " + userInfo.userId + " audio!")
    }).catch(() => {
        addSystemMsg("Stop receive " + userInfo.userId + " audio failed!")
    })

    for (const panel of videoPanels) {
        if (panel.userId === userInfo.userId && panel.audioId === userInfo.audioId) {
            panel.audioId = ""
            if (panel.videoId === "") {
                hstRtcEngine.unsetMediaRender(panel.userId, MediaType.VIDEO, panel.handle)
                panel.used = false
                panel.userId = ""
                $('#user-label-' + panel.index).html("")
            }
            break
        }
    }
    updateVideoPanelLayout()
}

// 停止接收用户视频
function stopReceiveUserVideo(userInfo) {
    if (!userInfo.pubVideo) return

    for (const mediaId of userInfo.videoId) {
        hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.VIDEO, mediaId).then(() => {
            addSystemMsg("Stop receive " + userInfo.userId + " video.")
        }).catch(() => {
            addSystemMsg("Stop receive " + userInfo.userId + " video failed!")
        })

        for (const panel of videoPanels) {
            if (panel.userId === userInfo.userId && panel.videoId === mediaId) {
                panel.videoId = ""
                $('#video-label-' + panel.index).html("")
                if (panel.audioId === "") {
                    hstRtcEngine.unsetMediaRender(panel.userId, MediaType.VIDEO, panel.handle)
                    panel.used = false
                    panel.userId = ""
                    $('#user-label-' + panel.index).html("")
                }
                break
            }
        }
    }
    updateVideoPanelLayout()
}

// 停止接收用户屏幕共享
function stopReceiveUserShare(userInfo) {
    if (!userInfo.pubShare) return

    hstRtcEngine.stopReceiveMedia(userInfo.userId, MediaType.SCREEN_SHARE, userInfo.shareId).then(() => {
        addSystemMsg("Stop receive " + userInfo.userId + " screen share!")
    }).catch(() => {
        addSystemMsg("Stop receive " + userInfo.userId + " screen share failed!")
    })

    for (const panel of screenSharePanels) {
        if (panel.userId === userInfo.userId) {
            hstRtcEngine.unsetMediaRender(panel.userId, MediaType.SCREEN_SHARE, panel.handle)
            panel.used = false
            panel.userId = ""
            panel.shareId = ""

            $('#share-user-label-' + panel.index).html("")
            $('#share-video-label-' + panel.index).html("")
            break
        }
    }
}

// 鼠标双击视频窗口和屏幕共享窗口最大化显示处理
function toggleMaxPanel() {
    if ($(this).attr("max") === "false") {
        $(this).attr("style", "position: absolute; left: 0; top: 0; z-index: 9999; width: 100vw; height: 100vh")
        $(this).attr("max", "true")
    } else {
        $(this).attr("style", "")
        $(this).attr("max", "false")
    }
}

