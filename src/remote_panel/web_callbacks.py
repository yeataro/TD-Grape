def onHTTPRequest(dat, request, response):
    return parent().op('runtime').module.http(request, response)

def onWebSocketOpen(dat, client, uri):
    parent().op('runtime').module.ws_open(client, uri)

def onWebSocketClose(dat, client):
    parent().op('runtime').module.ws_close(client)

def onWebSocketReceiveText(dat, client, data):
    parent().op('runtime').module.ws_receive(client, data)

def onWebSocketReceivePing(dat, client, data):
    dat.webSocketSendPong(client, data)
