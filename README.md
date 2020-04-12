CKEditor 5 Image URL embed feature
========================================

This package implements an image URL embed feature for CKEditor 5. You can use it to insert images by URL (.jpg, .png, .gif) into your rich text content.

It is simple modification of the [CKEditor 5 media embed feature](https://github.com/ckeditor/ckeditor5-media-embed).

## Usage

Import src/autoimageurlembed to your custom CKEditor 5 build.

```
import AutoImageUrlEmbed from './plugins/autoimageurlembed';
```

Add to the custom build plugins:

```
ClassicEditor.builtinPlugins = [
    ...,
    AutoImageUrlEmbed
]
```

## License

Licensed under the terms of [GNU General Public License Version 2 or later](http://www.gnu.org/licenses/gpl.html). For full details about the license, please check the `LICENSE.md` file.