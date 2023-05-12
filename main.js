"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
const fs = __importStar(require("fs"));
const tmp = __importStar(require("tmp"));
const fast_xml_parser_1 = require("fast-xml-parser");
const axios_1 = __importDefault(require("axios"));
const download_1 = __importDefault(require("download"));
async function jobArrived(s, flowElement, job) {
    let appName = await flowElement.getPropertyStringValue("appName");
    let datasetName = await flowElement.getPropertyStringValue("datasetName");
    // get app icon url
    let config = { method: 'get', url: 'https://www.enfocus.com/en/appstorefeed' };
    let APIresp;
    try {
        APIresp = await APIcall(config);
    }
    catch (error) {
        await job.log(LogLevel.Error, error.message);
        await job.sendToData(Connection.Level.Error, `${appName}.txt`);
        return;
    }
    let appsDetails = APIresp.data; // xml
    let appInfo = undefined;
    const parser = new fast_xml_parser_1.XMLParser();
    let appsDetailsObj = parser.parse(appsDetails); // json
    for (let i = 0; i < appsDetailsObj.rss.channel.item.length; i++) {
        if (appsDetailsObj.rss.channel.item[i].title == appName) {
            appInfo = appsDetailsObj.rss.channel.item[i];
        }
    }
    // app not found
    if (appInfo == undefined) {
        await job.log(LogLevel.Error, `The app with name '${appName}' does not exist.`);
        await job.sendToData(Connection.Level.Error, `${appName}.txt`);
        return;
    }
    // download icon to temp path
    const tmpIcon = tmp.fileSync({ prefix: appName, postfix: '.png' }).name;
    fs.writeFileSync(tmpIcon, await (0, download_1.default)(appInfo.guid));
    // create child job
    let newJob = await job.createChild(tmpIcon);
    // try to delete dataset to avoid fail job when dataset already exists with the same name
    try {
        await newJob.removeDataset(datasetName);
    }
    catch (error) {
        // dataset does not exist
    }
    // create and attach dataset to child job
    const tmpDataset = tmp.fileSync({ prefix: appName, postfix: '.json' }).name;
    fs.writeFileSync(tmpDataset, JSON.stringify(appInfo));
    await newJob.createDataset(datasetName, tmpDataset, DatasetModel.JSON);
    // send child job
    await newJob.sendToData(Connection.Level.Success, `${appName}.png`);
    // delete input job
    await job.sendToNull();
    // delete tmp files, use rimraf for folders
    fs.unlinkSync(tmpIcon);
    fs.unlinkSync(tmpDataset);
}
async function getLibraryForProperty(s, flowElement, tag) {
    if (tag == "appName") {
        let config = { method: 'get', url: 'https://www.enfocus.com/en/appstorefeed' };
        let APIresp;
        try {
            APIresp = await APIcall(config);
        }
        catch (error) {
            await flowElement.log(LogLevel.Error, error.message);
            return [];
        }
        let appsDetails = APIresp.data; // xml
        const parser = new fast_xml_parser_1.XMLParser();
        appsDetails = parser.parse(appsDetails); // json
        let appsList = [];
        for (let i = 0; i < appsDetails.rss.channel.item.length; i++) {
            appsList.push(appsDetails.rss.channel.item[i].title);
        }
        return (appsList); // array
    }
}
async function APIcall(config) {
    try {
        const response = await (0, axios_1.default)(config);
        return response;
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=main.js.map