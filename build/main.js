"use strict";
/*
 * Created with @iobroker/create-adapter v2.0.2
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = __importStar(require("@iobroker/adapter-core"));
const webuntis_1 = __importDefault(require("webuntis"));
// Load your modules here, e.g.:
// import * as fs from "fs";
class Webuntis extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'webuntis',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.timetableDate = new Date();
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Testen ob der Login funktioniert
        if (this.config.username == '') {
            this.log.error('No username set');
        }
        else if (this.config.client_secret == '') {
            this.log.error('No password set');
        }
        else {
            this.log.debug('Api login started');
            this.log.debug(this.config.username);
            this.log.debug(this.config.client_secret);
            // Test to login to WebUntis
            const untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
            untis.login().then(async () => {
                this.log.debug('WebUntis Login erfolgreich');
                // Now we can start
                this.readDataFromWebUntis();
            }).catch(async (error) => {
                this.log.error(error);
                this.log.error('Login WebUntis failed');
                await this.setStateAsync('info.connection', false, true);
            });
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            callback();
            this.clearTimeout(this.startHourScheduleTimeout);
        }
        catch (e) {
            callback();
        }
    }
    startHourSchedule() {
        if (this.startHourScheduleTimeout) {
            this.log.debug('clearing old refresh timeout');
            this.clearTimeout(this.startHourScheduleTimeout);
        }
        this.startHourScheduleTimeout = this.setTimeout(() => {
            this.log.debug('Read new data from WebUntis');
            this.readDataFromWebUntis();
        }, this.getMillisecondsToNextFullHour());
    }
    readDataFromWebUntis() {
        const untis = new webuntis_1.default(this.config.school, this.config.username, this.config.client_secret, this.config.baseUrl);
        untis.login().then(async () => {
            this.log.debug('WebUntis Login erfolgreich');
            //Start the loop, we have an session
            untis.getOwnTimetableForToday().then(async (timetable) => {
                if (timetable.length > 0) {
                    this.log.debug('Timetable gefunden');
                    this.timetableDate = new Date(); //info timetbale is fro today
                    await this.setTimeTable(timetable, 0);
                    await this.setStateAsync('info.connection', true, true);
                }
                else {
                    //Not timetable found, search next workingday
                    this.log.info('No timetable Today, search next working day');
                    this.timetableDate = this.getNextWorkDay(new Date());
                    untis.getOwnTimetableFor(this.timetableDate).then(async (timetable) => {
                        this.log.debug('Timetable an anderen Tag gefunden');
                        await this.setTimeTable(timetable, 0);
                        await this.setStateAsync('info.connection', true, true);
                    });
                }
                //Next day
                this.timetableDate.setDate(this.timetableDate.getDate() + 1);
                untis.getOwnTimetableFor(this.timetableDate).then(async (timetable) => {
                    await this.setTimeTable(timetable, 1);
                });
            });
        }).catch(async (error) => {
            this.log.error(error);
            this.log.error('Login WebUntis failed');
            await this.setStateAsync('info.connection', false, true);
        });
        // Next round in one Hour
        this.startHourSchedule();
    }
    //Function for Timetable
    async setTimeTable(timetable, dayindex) {
        //Info from this date is the timetable
        await this.setObjectNotExistsAsync(dayindex + '.timetable-date', {
            type: 'state',
            common: {
                name: 'timetable-date',
                role: 'value',
                type: 'string',
                write: false,
                read: true,
            },
            native: {},
        }).catch((error) => {
            this.log.error(error);
        });
        await this.setStateAsync(dayindex + '.timetable-date', this.timetableDate.toString(), true);
        let index = 0;
        let minTime = 2399;
        let maxTime = 0;
        let exceptions = false;
        timetable = timetable.sort((a, b) => a.startTime - b.startTime);
        this.log.debug(JSON.stringify(timetable));
        for (const element of timetable) {
            this.log.debug('Elemet gefunden für: ' + index.toString());
            this.log.debug(JSON.stringify(element));
            //create an Object for each elemnt on the day
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.startTime', {
                type: 'state',
                common: {
                    name: 'startTime',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + '.' + index.toString() + '.startTime', webuntis_1.default.convertUntisTime(element.startTime).toString(), true);
            //save mintime
            if (minTime > element.startTime)
                minTime = element.startTime;
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.endTime', {
                type: 'state',
                common: {
                    name: 'endTime',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + '.' + index.toString() + '.endTime', webuntis_1.default.convertUntisTime(element.endTime).toString(), true);
            //save maxtime
            if (maxTime < element.endTime)
                maxTime = element.endTime;
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.name', {
                type: 'state',
                common: {
                    name: 'name',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.su && element.su.length > 0) {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.name', element.su[0].name, true);
            }
            else {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.name', null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.teacher', {
                type: 'state',
                common: {
                    name: 'teacher',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.te && element.te.length > 0) {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.teacher', element.te[0].longname, true);
            }
            else {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.teacher', null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.room', {
                type: 'state',
                common: {
                    name: 'room',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.ro && element.ro.length > 0) {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.room', element.ro[0].name, true);
            }
            else {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.room', null, true);
            }
            await this.setObjectNotExistsAsync(dayindex + '.' + index.toString() + '.code', {
                type: 'state',
                common: {
                    name: 'code',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            if (element.code == 'cancelled' || element.code == 'irregular') {
                exceptions = true;
                await this.setStateAsync(dayindex + '.' + index.toString() + '.code', element.code, true);
            }
            else {
                await this.setStateAsync(dayindex + '.' + index.toString() + '.code', 'regular', true);
            }
            //Next Elemet
            index = index + 1;
        }
        if (index > 0) {
            this.log.info('HABEN folgenden MIN TIME:' + minTime);
            //we have min one element
            await this.setObjectNotExistsAsync(dayindex + '.minTime', {
                type: 'state',
                common: {
                    name: 'minTime',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + '.minTime', webuntis_1.default.convertUntisTime(minTime).toString(), true);
            await this.setObjectNotExistsAsync(dayindex + '.maxTime', {
                type: 'state',
                common: {
                    name: 'maxTime',
                    role: 'value',
                    type: 'string',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + '.maxTime', webuntis_1.default.convertUntisTime(maxTime).toString(), true);
            await this.setObjectNotExistsAsync(dayindex + '.exceptions', {
                type: 'state',
                common: {
                    name: 'maxTime',
                    role: 'value',
                    type: 'boolean',
                    write: false,
                    read: true,
                },
                native: {},
            }).catch((error) => {
                this.log.error(error);
            });
            await this.setStateAsync(dayindex + '.exceptions', exceptions, true);
        }
        //check if an Object is over the max index
        await this.deleteOldObject(index);
    }
    //Helpfunction
    async deleteOldObject(index) {
        index = index;
        const delObject = await this.getObjectAsync(index.toString() + '.name');
        if (delObject) {
            this.log.debug('Object zum löschen gefunden - ' + index.toString());
            await this.delObjectAsync(index.toString(), { recursive: true });
            // Have one delted, next round
            await this.deleteOldObject(index + 1);
        }
    }
    getNextWorkDay(date) {
        const d = new Date(+date);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() + (day > 4 ? 8 - day : 1));
        return d;
    }
    //thanks to klein0r
    getMillisecondsToNextFullHour() {
        const now = new Date();
        const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 5, 0); // add 5 seconds to ensure we are in the next hour
        return nextHour.getTime() - now.getTime();
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new Webuntis(options);
}
else {
    // otherwise start the instance directly
    (() => new Webuntis())();
}
//# sourceMappingURL=main.js.map