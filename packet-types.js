"use strict";
var GearmanPacket = exports;
GearmanPacket.adminTypes = {
    'error': { args: ['code','message'] },
    'ok': { args: ['line'] },
    'line': { args: ['line'] },
    'block-complete': { args: [] }
}
GearmanPacket.types = {
    CAN_DO: {id: 1, args: ['function']},
    CANT_DO: {id: 2, args: ['function']},
    RESET_ABILITIES: {id: 3, args: []},
    PRE_SLEEP: {id: 4, args: []},
    NOOP: {id: 6, args: []},
    SUBMIT_JOB: {id: 7, args: ['function','uniqueid'], body: true},
    JOB_CREATED: {id: 8, args: ['job']},
    GRAB_JOB: {id: 9, args: []},
    NO_JOB: {id: 10, args: []},
    JOB_ASSIGN: {id: 11, args: ['job','function'], body: true},
    WORK_STATUS: {id: 12, args: ['job','complete','total']},
    WORK_COMPLETE: {id: 13, args: ['job'], body: true},
    WORK_FAIL: {id: 14, args: ['job']},
    GET_STATUS: {id: 15, args: ['job']},
    ECHO_REQ: {id: 16, args: [], body: true},
    ECHO_RES: {id: 17, args: [], body: true},
    SUBMIT_JOB_BG: {id: 18, args: ['function','uniqueid'], body: true},
    ERROR: {id: 19, args: ['errorcode'], body: true},
    STATUS_RES: {id: 20, args: ['job','known','running','complete','total']},
    SUBMIT_JOB_HIGH: {id: 21, args: ['function','uniqueid'], body: true},
    SET_CLIENT_ID: {id: 22, args: ['workerid']},
    CAN_DO_TIMEOUT: {id: 23, args: ['function','timeout']},
    ALL_YOURS: {id: 24, args: []},
    WORK_EXCEPTION: {id: 25, args: ['job'], body: true},
    OPTION_REQ: {id: 26, args: ['option']},
    OPTION_RES: {id: 27, args: ['option']},
    WORK_DATA: {id: 28, args: ['job'], body: true},
    WORK_WARNING: {id: 29, args: ['job'], body: true},
    GRAB_JOB_UNIQ: {id: 30, args: []},
    JOB_ASSIGN_UNIQ: {id: 31, args: ['job','function','uniqueid'], body: true},
    SUBMIT_JOB_HIGH_BG: {id: 32, args: ['function','uniqueid'], body: true},
    SUBMIT_JOB_LOW: {id: 33, args: ['function','uniqueid'], body: true},
    SUBMIT_JOB_LOW_BG: {id: 34, args: ['function','uniqueid'], body: true},
    SUBMIT_JOB_SCHED: {id: 35, args: ['function','uniqueid','minute','hour','day','month','dow'], body: true},
    SUBMIT_JOB_EPOCH: {id: 36, args: ['function','uniqueid','time'], body: true}
};
GearmanPacket.typesById = [];
for (var name in GearmanPacket.types) {
    GearmanPacket.types[name].name = name;
    GearmanPacket.typesById[GearmanPacket.types[name].id] = GearmanPacket.types[name];
}
for (var name in GearmanPacket.adminTypes) {
    GearmanPacket.adminTypes[name].name = name;
}
