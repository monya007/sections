/**
 * @module templates/templates
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';
import Element from '@ckeditor/ckeditor5-engine/src/model/element'
import TemplateElement from './templateelement';
import MediaSelectCommand from "./commands/mediaselectcommand";
import SectionToolbar from "./sectiontoolbar";

import "../theme/css/media.css";

/**
 * @extends module:core/plugin~Plugin
 */
export default class Templates extends Plugin {

  /**
   * @inheritDoc
   */
  constructor(editor) {
    super(editor);
    editor.config.define('templates', []);
    editor.config.define('rootTemplate', null);
    editor.config.define('templateElements', []);
    editor.config.define('entitySelector', () => '');
    editor.config.define('entityRenderer', () => '');
    this.elements = {};
  }

  /**
   * @inheritDoc
   */
  static get requires() {
    return [Widget, SectionToolbar];
  }

  /**
   * @inheritDoc
   */
  static get pluginName() {
    return 'Templates';
  }

  /**
   * @inheritDoc
   */
  init() {

    const templates = this.editor.config.get('templates');
    Object.keys(templates).forEach((name) => {
      const template = (new DOMParser()).parseFromString(templates[name].template, 'text/xml').documentElement;
      template.setAttribute('ck-name', name);
      this._registerElement(template);
    });

    const rootTemplate = this.editor.config.get('rootTemplate');
    if (rootTemplate) {
      const templateId = 'ck-templates__' + rootTemplate;
      this.editor.model.schema.addChildCheck((context, def) => {
        if (context.endsWith('$root') && def.name === templateId) {
          return true;
        }
      });
      this.editor.model.document.registerPostFixer( writer => this._cleanRoot( writer, templateId) );
      this.editor.on( 'dataReady', () => {
        this.editor.model.enqueueChange( 'transparent', writer => this._cleanRoot( writer, templateId) );
      }, { priority: 'lowest' } );
    }

    this.editor.commands.add('mediaSelect', new MediaSelectCommand(this.editor));
  }

  _cleanRoot(writer, rootTemplate) {

    const model = this.editor.model;

    for ( const rootName of model.document.getRootNames() ) {
      const root = model.document.getRoot( rootName );

      if (root.rootName === '$graveyard' ) {
        continue
      }

      for (let child of root.getChildren()) {
        if (child.name !== rootTemplate) {
          writer.remove(child);
          return true;
        }
      }

      if (root.isEmpty) {
        writer.appendElement(rootTemplate, root);
        return true;
      }
    }
  }

  /**
   * Parse a single template html element.
   *
   * @param {Node} template - The DOM `Element` node.
   * @param {TemplateElement} parent - The parent element's name.
   * @param {Number} index - The index within the parent element.
   *
   * @return {TemplateElement} - The newly registered element.
   *
   * @private
   */
  _registerElement(template, parent = null, index = 0)  {
    const applicableElements = this.editor.config.get('templateElements')
        .filter((element) => {
          return element.applies(template);
        });

    if (!applicableElements) {
      return null;
    }

    const ElementConstructor = applicableElements[0];

    const childNodes = Array.from(template.childNodes).filter(node => node.nodeType === 1);

    /** @type {TemplateElement} */
    const element = new ElementConstructor(this.editor, template, parent, index);
    this.elements[element.name] = element;

    /** @type {TemplateElement[]} */
    const children = childNodes
        .map(child => this._registerElement(child, element, childNodes.indexOf(child)))
        .filter( child => !!child);

    element.setChildren(children);
    element.setTemplateManager(this);

    const attributes = Array.from(new Set(Array.from(template.attributes)
        .map(attr => attr.name)
        .concat(Object.keys(element.defaultAttributes))));

    this.editor.model.schema.register(element.name, Object.assign({
      allowAttributes: attributes,
    }, element.schema));
    this.editor.conversion.for('upcast').add(element.upcast);
    this.editor.conversion.for('dataDowncast').add(element.dataDowncast);
    this.editor.conversion.for('editingDowncast').add(element.editingDowncast);

    for (const attr of attributes) {
      if (attr !== 'class' && attr.substr(0, 3) !== 'ck-') {
        this.editor.conversion.for('downcast').add(modelToViewAttributeConverter(attr, element.name))
      }
    }

    this.editor.model.document.registerPostFixer((writer) => {
      for (const entry of this.editor.model.document.differ.getChanges()) {
        if (entry.type === 'insert' && element.name === entry.name) {
          const item = entry.position.nodeAfter;
          if (this._recursiveElementPostFix(element, writer, item)) {
            return true;
          }
        }
      }
    });

    this.editor.model.schema.addChildCheck((context, def) => {
      if (context.endsWith(element.name)) {
        return element.childCheck(def);
      }
    });

    return element;
  }

  _recursiveElementPostFix(element, writer, item) {
    let changed = false;
    if (item instanceof Element) {
      const children = item.getChildren();
      for (let child of children) {
        changed = this._recursiveElementPostFix(this.elements[child.name], writer, child) || changed;
      }
      changed = element.postfix(writer, item) || changed;
    }
    return changed;
  }

}

export function modelToViewAttributeConverter( attributeKey, element ) {
  return dispatcher => {
    dispatcher.on( `attribute:${ attributeKey }:${ element }`, converter );
  };

  function converter( evt, data, conversionApi ) {
    if ( !conversionApi.consumable.consume( data.item, evt.name )) {
      return;
    }

    const viewWriter = conversionApi.writer;
    const entity = conversionApi.mapper.toViewElement( data.item );

    if ( data.attributeNewValue !== null ) {
      viewWriter.setAttribute( data.attributeKey, data.attributeNewValue, entity );
    } else {
      viewWriter.removeAttribute( data.attributeKey, entity );
    }
  }
}
