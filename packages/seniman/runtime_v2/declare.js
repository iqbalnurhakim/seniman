
export let blockDefinitions = new Map();
export let firstChild = 1;
export let nextSibling = 2;
//export let doubleNextSibling = 3;

let lastBlockId = 2000;

function createNewBlockId() {
    lastBlockId++;
    return lastBlockId;
}

export function _declareBlock(def) {
    let blockId = createNewBlockId();

    blockDefinitions.set(blockId, def);

    return blockId;
}

let CMD_INSTALL_TEMPLATE = 1;
let CMD_MODIFY_TOKENMAP = 12;

export function streamBlockTemplateInstall(window, templateId) {

    let blockDef = blockDefinitions.get(templateId);
    let tokenIdsMap = installTokens(blockDef.tokens, window.tokenMap);

    let tagNamesTokenIds = tokenIdsMap.tagNames[0];
    let attrNamesTokenIds = tokenIdsMap.attrNames[0];
    let styleKeysTokenIds = tokenIdsMap.styleKeys[0];
    let styleValuesTokenIds = tokenIdsMap.styleValues[0];

    let variableScratchBuffer = Buffer.alloc(2048);
    let tagNamesInstallList = tokenIdsMap.tagNames[1];
    let attrNamesInstallList = tokenIdsMap.attrNames[1];
    let styleKeysInstallList = tokenIdsMap.styleKeys[1];
    let styleValuesInstallList = tokenIdsMap.styleValues[1];

    variableScratchBuffer.writeUint8(CMD_MODIFY_TOKENMAP, 0);

    let offset2 = 1;

    let lists = [
        tagNamesInstallList,
        attrNamesInstallList,
        //attrValuesInstallList,
        styleKeysInstallList,
        styleValuesInstallList
    ];

    lists.forEach((list) => {
        list.forEach((token) => {
            let tokenLength = Buffer.byteLength(token);

            variableScratchBuffer.writeUint8(tokenLength, offset2);
            offset2++;

            variableScratchBuffer.write(token, offset2, tokenLength);
            offset2 += tokenLength;
        });

        variableScratchBuffer.writeUint8(0, offset2);
        offset2++;
    });

    // copy the scratch buffer to a real command buffer
    variableScratchBuffer.copy(window._allocCommandBuffer(offset2), 0, 0, offset2);

    //////////////////////////

    let buf = Buffer.alloc(4096 * 2);

    let offset = 0;
    buf.writeUint8(CMD_INSTALL_TEMPLATE, 0);
    buf.writeUint16BE(templateId, 1);
    offset += 3;

    let lists2 = [
        tagNamesTokenIds,
        attrNamesTokenIds,
        //attrValuesTokenIds,
        styleKeysTokenIds,
        styleValuesTokenIds
    ];

    lists2.forEach((list) => {
        list.forEach((token) => {
            buf.writeUint16BE(token, offset);
            offset += 2;
        });

        buf.writeUint16BE(0, offset);
        offset += 2;
    });

    let templateBuffer = Buffer.from(blockDef.templateBuffer, 'base64');
    let elScriptBuffer = Buffer.from(blockDef.elScriptBuffer, 'base64');

    templateBuffer.copy(buf, offset);
    offset += templateBuffer.length;

    elScriptBuffer.copy(buf, offset);
    offset += elScriptBuffer.length;

    let commandBuf = window._allocCommandBuffer(offset);
    buf.copy(commandBuf, 0, 0, offset);
}

function installTokenArray(tokenArray, tokenMap) {
    let result = [];
    let installationList = [];

    for (let token of tokenArray) {
        if (tokenMap.has(token)) {
            result.push(tokenMap.get(token));
        } else {
            let index = tokenMap.size + 1;

            tokenMap.set(token, index);

            installationList.push(token);
            result.push(index);
        }
    }

    return [result, installationList];
}

function installTokens(blockTokens, tokenMap) {
    return {
        tagNames: installTokenArray(blockTokens.tagNames, tokenMap.tagNames),
        attrNames: installTokenArray(blockTokens.attrNames, tokenMap.attrNames),
        //attrValues: installTokenArray(blockTokens.attrValues, tokenMap.attrValues),
        styleKeys: installTokenArray(blockTokens.styleKeys, tokenMap.styleKeys),
        styleValues: installTokenArray(blockTokens.styleValues, tokenMap.styleValues)
    }
}

export let clientFunctionDefinitions = new Map();

let lastClientFunctionId = 3000;

function createNewClientFunctionId() {
    lastClientFunctionId++;
    return lastClientFunctionId;
}

export function _declareClientFunction(def) {

    let clientFunctionId = createNewClientFunctionId();

    clientFunctionDefinitions.set(clientFunctionId, def);

    return clientFunctionId;
}