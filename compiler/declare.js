import { encode } from 'base64-arraybuffer';


export function createDeclareBlockExpression(block, encodeCompressionMap) {

    return {
        "type": "CallExpression",
        "callee": {
            "type": "Identifier",
            "name": "_declareBlock"
        },
        "arguments": [
            {
                "type": "Identifier",
                "name": block.id.toString()
            },

            {
                "type": "ObjectExpression",
                "properties": [getTemplateStringInit(block, encodeCompressionMap), getElscriptInit(block)]
            }
        ]
    }
}

function getTemplateStringInit(block, encodeCompressionMap) {

    //console.log('======================');
    let buffer = getTemplateBuffer(block, encodeCompressionMap);

    //console.log('getTemplateString2 buffer len', buffer.length);

    return {
        "type": "ObjectProperty",
        "key": {
            "type": "Identifier",
            "name": "templateBuffer"
        },
        "value": {
            "type": "StringLiteral",
            "value": encode(buffer)
        }
    };
}


let selfClosingTagSet = new Set(['hr', 'img', 'input']);

/*

let typeIdMapping = {
    div: 1,
    span: 2,
    input: 3,
    img: 4,
    p: 5,
    a: 6,
    hr: 7,
    button: 8,
    select: 9,
    option: 10
};

let staticAttributeMap = {
    style: 1,
    'class': 2,
    href: 3,
    type: 4,
    src: 5
}
*/

/*
let dynamicAttributeMap = {
    style: 1,
    'class': 2
}
*/

/*

staticMapping = {div: 1, span: 2,}
dynamicMapping

elementTemplate:
2-byte: element count

per-element encoding:

1) ELEMENT TAGNAME

    1st byte.
    first 6-bit is the ID of the tagName within the static elementTagName map, with maximum of 63 elements.
    last 2-bit is metadata.
    0 0: has next sibling, has children

    If ID of tagName is 32 (naked text), then the following section handling will be different than regular elements.

2) ELEMENT ATTRIBUTES (regular elements)

    key
    2nd byte

    bit 0
    if 0, then it's a 1-byte encoding using static map with maximum of 127 entries.
    if 1, then it's a 2-byte encoding using dynamic map with maximum of 32678 entries.

    if byte value is 0, terminate the attribute loop, and continue to processing the next element.

    value
    4th byte

    Format of this will vary based on the preceding key. Special casing will apply for two specific attributes,
    `class` and `style`. Values for other attribute keys will be treated similarly: as strings.

    If attribute is `class`:

    if 0, then it's a 1-byte encoding using static map with maximum of 128 entries.
    if 1, then it's a 2-byte encoding using dynamic map with maximum of 32678 entries.

    if byte value is 0, this means the equivalent of a `break` -- we should loop to the next attribute.
*/

function getTemplateBuffer(block, encodeCompressionMap) {

    let offset = 0;
    let buf = Buffer.alloc(2048);
    let totalElementCount = 0;

    //console.log('block', JSON.stringify(block.rootElement));

    function dig(siblings) {

        let elCount = siblings.length;

        for (let i = 0; i < elCount; i++) {
            totalElementCount++;

            let el = siblings[i];

            let tagNameId = el.type == '$text' ? 32 : encodeCompressionMap.typeIdMapping[el.type];
            let filteredChildren = (el.children || []).filter(childEl => childEl.type != '$anchor');

            let hasChildren = filteredChildren.length > 0;
            let nextSibling = i < (elCount - 1);

            let firstByte = tagNameId & 63; // AND to get the first 6-bits

            if (hasChildren) {
                // set hasChildren (7th bit)
                firstByte = firstByte | (1 << 6);
            }

            if (nextSibling) {
                // set nextSibling (8th bit)
                firstByte = firstByte | (1 << 7);
            }

            //console.log('tagNameId', el.type, tagNameId, hasChildren, nextSibling)

            buf.writeUint8(firstByte, offset);
            offset++;

            // if this is a text
            if (tagNameId == 32) {
                buf.writeUint16BE(el.value.length, offset);
                offset += 2;

                // write the string
                buf.write(el.value, offset, el.value.length);
                offset += el.value.length;

            } else {

                //console.log('el.attributes', el.attributes);

                for (let attrName in el.attributes) {

                    let attrId = encodeCompressionMap.staticAttributeMap[attrName];

                    if (!attrId) {
                        throw new Error();
                    }

                    buf.writeUint8(attrId, offset);
                    offset++;

                    if (attrName == 'style') {

                        for (let i = 0; i < el.style.length; i++) {
                            let [propName, propValue] = el.style[i];

                            buf.writeUint8(encodeCompressionMap.stylePropertyKeys[propName], offset);
                            buf.writeUint8(encodeCompressionMap.stylePropertyValues[propValue], offset + 1);

                            offset += 2;
                        }

                        buf.writeUint8(0, offset);

                        offset++;
                    } else {

                        let attrValue = el.attributes[attrName];
                        buf.writeUint16BE(attrValue.length, offset);

                        offset += 2;
                        buf.write(attrValue, offset, attrValue.length);
                        offset += attrValue.length;
                    }
                }

                buf.writeUint8(0, offset);
                offset++;
            }

            if (hasChildren) {
                dig(filteredChildren);
            }
        }
    }

    dig([block.rootElement]);

    //console.log('totalElementCount', totalElementCount);
    //console.log('offset BUFFERTEMPLATE', offset);

    let elementCountBuffer = Buffer.alloc(2);

    elementCountBuffer.writeUint16BE(totalElementCount);

    return Buffer.concat([elementCountBuffer, buf.subarray(0, offset)]);
}

function getElscriptInit(block) {
    return {
        "type": "ObjectProperty",
        "key": {
            "type": "Identifier",
            "name": "elScriptBuffer"
        },
        "value": {
            "type": "StringLiteral",
            "value": encode(getElscriptBuffer(block))
        }
    };
}

function getElscriptBuffer(block) {

    function dig3(el) {
        let needsReference = el.isTarget || false;
        let childrenCount = el.type == '$text' ? 0 : el.children.length;

        // TODO: for each anchor element, find text or element nextSibling index.
        for (let i = 0; i < childrenCount; i++) {
            let childEl = el.children[i];

            if (childEl.type == '$anchor') {
                needsReference = true;
            } else {

                if (childEl.type != '$text') {
                    let childNeedsReference = dig3(childEl);

                    if (childNeedsReference) {
                        needsReference = childNeedsReference;
                    }
                }
            }
        }

        el.needsReference = needsReference;

        return needsReference;
    }


    dig3(block.rootElement);

    let firstChild = 1;
    let nextSibling = 2;
    let doubleNextSibling = 3;

    let _els = [];
    let _anchors = [];
    let _targets = [];

    function _buildElScript(el, elIndex) {

        let olderSiblingIndex;
        let childrenCount = el.type == '$text' ? 0 : el.children.length;

        let precedingAnchors = [];
        let firstNonAnchorProcessed = false;

        for (let i = 0; i < childrenCount; i++) {
            let childEl = el.children[i];

            if (childEl.type == '$anchor') {
                let _anchor = { el: elIndex };
                _anchors.push(_anchor);
                precedingAnchors.push(_anchor);
            } else {

                if (!firstNonAnchorProcessed) {
                    _els.push({
                        rel: firstChild, relRefId: elIndex
                    });
                    firstNonAnchorProcessed = true;
                } else {
                    _els.push({
                        rel: nextSibling, relRefId: olderSiblingIndex
                    });
                }

                let currentElIndex = _els.length - 1;

                olderSiblingIndex = currentElIndex;

                if (childEl.isTarget) {
                    _targets.push(currentElIndex);
                }

                if (childEl.needsReference && childEl.children.length > 0) {
                    _buildElScript(childEl, currentElIndex);
                }

                precedingAnchors.forEach(anchor => {
                    anchor.beforeEl = currentElIndex;
                });

                precedingAnchors = [];
            }
        }

    }

    _buildElScript(block.rootElement, 255);


    let lengthBeforePrune = _els.length;

    /*
    console.log('els', _els);
    console.log('anchors', _anchors);
    console.log('targets', _targets);
    */
    function prune() {

        for (let i = _els.length - 1; i >= 0; i--) {

            let hasDependency = false;

            for (let j = 0; j < _els.length; j++) {
                if (_els[j].relRefId == i) {
                    hasDependency = true;
                    break;
                }
            }

            for (let j = 0; j < _anchors.length; j++) {
                let anchor = _anchors[j];

                if (anchor.el == i || anchor.beforeEl == i) {
                    hasDependency = true;
                    break;
                }
            }

            for (let j = 0; j < _targets.length; j++) {
                let targetElIndex = _targets[j];

                if (targetElIndex == i) {
                    hasDependency = true;
                    break;
                }
            }

            if (hasDependency) {
                continue;
            }

            // if the element can be removed, update the entries.
            _els.splice(i, 1);

            for (let j = i; j < _els.length; j++) {

                let _el = _els[j];

                if (_el.relRefId < 255 && _el.relRefId > i) {
                    _el.relRefId -= 1;
                }
            }


            for (let j = 0; j < _anchors.length; j++) {

                let _anchor = _anchors[j];

                if (_anchor.el > i && _anchor.el != 255) {
                    _anchor.el -= 1;
                }

                if (_anchor.beforeEl != undefined && _anchor.beforeEl > i) {
                    _anchor.beforeEl -= 1;
                }
            }

            for (let j = 0; j < _targets.length; j++) {

                if (_targets[j] == 255) {
                    throw new Error('Invalid compiler implementation. Root element (id 255) need not be part of the targets array.');
                }

                if (_targets[j] > i && _targets[j] != 255) {
                    _targets[j] -= 1;
                }
            }
        }
    }

    //console.time('prune');
    prune();
    //console.timeEnd('prune');

    /*
    if (lengthBeforePrune != _els.length) {
        console.log('PRUNING WORKS!', lengthBeforePrune, _els.length);

        console.log('els', _els);
        console.log('anchors', _anchors);
        console.log('targets', _targets);
        console.log('=======================')
    }
    */


    return _createElScriptBuffer(_els, _anchors, _targets);

    //console.log('createElScriptBuffer lenght', buffer.length);

    return {
        "type": "ObjectProperty",
        "key": {
            "type": "Identifier",
            "name": "elScriptBuffer"
        },
        "value": {
            "type": "StringLiteral",
            "value": encode(buffer)
        }
    };

}




function _createElScriptBuffer(els, anchors, targets) {

    let refElementsCount = els.length;
    let anchorCount = anchors.length;
    let targetElementCount = targets.length;

    let bufLen = (1 + 2 * refElementsCount) + (1 + 2 * anchorCount) + (1 + 1 * targetElementCount);
    let buf = Buffer.alloc(bufLen);

    buf.writeUint8(refElementsCount, 0);

    let offset = 1;
    for (let i = 0; i < refElementsCount; i++) {
        let refEl = els[i];
        //let relCodeMap = {firstChild}
        buf.writeUint8(refEl.rel, offset + i * 2);
        buf.writeUint8(refEl.relRefId, offset + i * 2 + 1);
    }

    offset += 2 * refElementsCount;
    buf.writeUint8(anchorCount, offset);
    offset++;

    for (let i = 0; i < anchorCount; i++) {
        let anchor = anchors[i];

        buf.writeUint8(anchor.el, offset + i * 2);

        // in beforeEl context, 255 means undefined -- ie. no beforeEl applicable. 
        // 255 that is usually used to refer to rootElement can be reused here since 
        // there is no situation in which rootElement is an anchor's beforeElement.
        buf.writeUint8(anchor.beforeEl == undefined ? 255 : anchor.beforeEl, offset + i * 2 + 1)
    }

    offset += 2 * anchorCount;
    buf.writeUint8(targetElementCount, offset);
    offset++;

    for (let i = 0; i < targetElementCount; i++) {
        let target = targets[i];

        buf.writeUint8(target, offset + i);
    }

    offset += targetElementCount;

    // console.log('offset', offset);
    //console.log('targetElementCount', targetElementCount)

    return buf;
}