def onOffer(dat, connectionId, localSdp):
    parent().op('runtime').module.rtc_offer(dat, connectionId, localSdp)

def onIceCandidate(dat, connectionId, candidate, lineIndex, sdpMid):
    parent().op('runtime').module.rtc_ice(connectionId, candidate, lineIndex, sdpMid)

def onConnectionStateChange(dat, connectionId, newState):
    parent().op('runtime').module.rtc_state(connectionId, newState)

def onData(dat, connectionId, channelName, data):
    parent().op('runtime').module.rtc_data(connectionId, channelName, data)
