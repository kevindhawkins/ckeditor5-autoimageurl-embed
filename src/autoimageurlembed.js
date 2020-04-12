/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * Copyright (c) 2020 GameDev.net - Kevin Hawkins. All rights reserved.
 * 
 * The following code is a derivative work of the code from CKEditor 5 by CKSource, 
 * which is licensed GPLv2. This code therefore is also licensed under th terms of the 
 * GNU Public License, version 2.
 */

/**
 * @module autoimageurlembed
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import Clipboard from '@ckeditor/ckeditor5-clipboard/src/clipboard';
import LiveRange from '@ckeditor/ckeditor5-engine/src/model/liverange';
import LivePosition from '@ckeditor/ckeditor5-engine/src/model/liveposition';
import Undo from '@ckeditor/ckeditor5-undo/src/undo';
import global from '@ckeditor/ckeditor5-utils/src/dom/global';

const URL_REGEXP = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=]+$/;

// testImage function by Stackoverflow user jfriend00
// https://stackoverflow.com/a/9714891
function testImage(url, timeoutT) {
    return new Promise(function (resolve, reject) {
        var timeout = timeoutT || 5000;
        var timer, img = new Image();
        img.onerror = img.onabort = function () {
            clearTimeout(timer);
            reject("error");
        };
        img.onload = function () {
            clearTimeout(timer);
            resolve("success");
        };
        timer = setTimeout(function () {
            // reset .src to invalid URL so it stops previous
            // loading, but doesn't trigger new load
            img.src = "//!!!!/test.jpg";
            reject("timeout");
        }, timeout);
        img.src = url;
    });
}

function isImageUrl(url) {
    return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
}

function insertImage(model, url, insertPosition) {
	testImage(url, 10000).then(function(result, failure) {
		if (result === 'success') {
			model.change( writer => {
				const imgElement = writer.createElement('image', {src: url});

				model.insertContent(imgElement, insertPosition);
				writer.setSelection(imgElement, 'on');
			});
		}
	});
}

/**
 * The auto-image embed plugin. It recognizes image links in the pasted content and embeds
 * them shortly after they are injected into the document.
 *
 * @extends module:core/plugin~Plugin
 */
export default class AutoImageUrlEmbed extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ Clipboard, Undo ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'AutoImageUrlEmbed';
	}

	/**
	 * @inheritDoc
	 */
	constructor( editor ) {
		super( editor );

		/**
		 * The paste–to–embed `setTimeout` ID. Stored as a property to allow
		 * cleaning of the timeout.
		 *
		 * @private
		 * @member {Number} #_timeoutId
		 */
		this._timeoutId = null;

		/**
		 * The position where the `<figure>` element will be inserted after the timeout,
		 * determined each time the new content is pasted into the document.
		 *
		 * @private
		 * @member {module:engine/model/liveposition~LivePosition} #_positionToInsert
		 */
		this._positionToInsert = null;
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const modelDocument = editor.model.document;

		// We need to listen on `Clipboard#inputTransformation` because we need to save positions of selection.
		// After pasting, the content between those positions will be checked for a URL that could be transformed
		// into media.
		this.listenTo( editor.plugins.get( Clipboard ), 'inputTransformation', () => {
			const firstRange = modelDocument.selection.getFirstRange();

			const leftLivePosition = LivePosition.fromPosition( firstRange.start );
			leftLivePosition.stickiness = 'toPrevious';

			const rightLivePosition = LivePosition.fromPosition( firstRange.end );
			rightLivePosition.stickiness = 'toNext';

			modelDocument.once( 'change:data', () => {
				this._embedMediaBetweenPositions( leftLivePosition, rightLivePosition );

				leftLivePosition.detach();
				rightLivePosition.detach();
			}, { priority: 'high' } );
		} );

		editor.commands.get( 'undo' ).on( 'execute', () => {
			if ( this._timeoutId ) {
				global.window.clearTimeout( this._timeoutId );
				this._positionToInsert.detach();

				this._timeoutId = null;
				this._positionToInsert = null;
			}
		}, { priority: 'high' } );
	}

	/**
	 * Analyzes the part of the document between provided positions in search for a URL representing media.
	 * When the URL is found, it is automatically converted into media.
	 *
	 * @protected
	 * @param {module:engine/model/liveposition~LivePosition} leftPosition Left position of the selection.
	 * @param {module:engine/model/liveposition~LivePosition} rightPosition Right position of the selection.
	 */
	_embedMediaBetweenPositions( leftPosition, rightPosition ) {
		const editor = this.editor;
		// TODO: Use marker instead of LiveRange & LivePositions.
		const urlRange = new LiveRange( leftPosition, rightPosition );
		const walker = urlRange.getWalker( { ignoreElementEnd: true } );

		let url = '';

		for ( const node of walker ) {
			if ( node.item.is( 'textProxy' ) ) {
				url += node.item.data;
			}
		}

		url = url.trim();

		// If the URL does not match to universal URL regexp, let's skip that.
		if ( !url.match( URL_REGEXP ) ) {
			return;
		}

		// if the URL is an image, let's use it
		if (!isImageUrl(url)) {
			return;
		}

		// Position won't be available in the `setTimeout` function so let's clone it.
		this._positionToInsert = LivePosition.fromPosition( leftPosition );

		// This action mustn't be executed if undo was called between pasting and auto-embedding.
		this._timeoutId = global.window.setTimeout( () => {
			editor.model.change( writer => {
				this._timeoutId = null;

				writer.remove( urlRange );

				let insertionPosition;

				// Check if position where the media element should be inserted is still valid.
				// Otherwise leave it as undefined to use document.selection - default behavior of model.insertContent().
				if ( this._positionToInsert.root.rootName !== '$graveyard' ) {
					insertionPosition = this._positionToInsert;
				}

				insertImage( editor.model, url, insertionPosition );

				this._positionToInsert.detach();
				this._positionToInsert = null;
			} );
		}, 100 );
	}
}