import * as fs from "fs";
import * as tmp from "tmp";
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import download from "download";

async function jobArrived(s: Switch, flowElement: FlowElement, job: Job) {

    let appName: string = await flowElement.getPropertyStringValue("appName") as string;
    let datasetName: string = await flowElement.getPropertyStringValue("datasetName") as string;

    // get app icon url
    let config: AxiosRequestConfig = { method: 'get', url: 'https://www.enfocus.com/en/appstorefeed' };
    let APIresp;
    try {
        APIresp = await APIcall(config);
    } catch (error) {
        await job.log(LogLevel.Error, (error as Error).message);
        await job.sendToData(Connection.Level.Error, `${appName}.txt`)
        return;
    }

    let appsDetails: string = APIresp.data; // xml
    let appInfo: Record<string, any> | undefined = undefined;
    const parser = new XMLParser();
    let appsDetailsObj: Record<string, any> = parser.parse(appsDetails); // json

    for (let i = 0; i < appsDetailsObj.rss.channel.item.length; i++) {
        if (appsDetailsObj.rss.channel.item[i].title == appName) {
            appInfo = appsDetailsObj.rss.channel.item[i];
        }
    }

    // app not found
    if (appInfo == undefined) {
        await job.log(LogLevel.Error, `The app with name '${appName}' does not exist.`);
        await job.sendToData(Connection.Level.Error, `${appName}.txt`)
        return;
    }

    // download icon to temp path
    const tmpIcon: string = tmp.fileSync({ prefix: appName, postfix: '.png' }).name;
    fs.writeFileSync(tmpIcon, await download(appInfo.guid));

    // create child job
    let newJob = await job.createChild(tmpIcon);

    // try to delete dataset to avoid fail job when dataset already exists with the same name
    try {
        await newJob.removeDataset(datasetName);
    } catch (error) {
        // dataset does not exist
    }

    // create and attach dataset to child job
    const tmpDataset: string = tmp.fileSync({ prefix: appName, postfix: '.json' }).name;
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

async function getLibraryForProperty(s: Switch, flowElement: FlowElement, tag: string) {
    if (tag == "appName") {
        let config = { method: 'get', url: 'https://www.enfocus.com/en/appstorefeed' };
        let APIresp: AxiosResponse;
        try {
            APIresp = await APIcall(config);
        } catch (error) {
            await flowElement.log(LogLevel.Error, (error as Error).message);
            return [];
        }
        let appsDetails = APIresp.data; // xml
        const parser = new XMLParser();
        appsDetails = parser.parse(appsDetails); // json
        let appsList = []
        for (let i = 0; i < appsDetails.rss.channel.item.length; i++) {
            appsList.push(appsDetails.rss.channel.item[i].title)
        }
        return (appsList); // array
    }
}

async function APIcall(config: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
        const response = await axios(config);
        return response;
    } catch (error: any) {
        throw error;
    }
}