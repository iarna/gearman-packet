Emitter:

* Test various admin packet types:
  * error - require codes, optionally take messages
  * ok - optionally takes line attribute
  * line - must have line attribute
  * block-complete

Parser:

* Test that maxPacketSize is enforced
  * Emits an error if a packet reports a size greater than maxPacketSize and skips the packet.
* Test new admin packet types: error, ok, line, block-complete
* Test that admin packets beyond 1024 now send back and admin error packet. (code TOOLONG)
