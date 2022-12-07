odoo.define('flexibite_ee_advance.ComboReplaceProductItemS', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;
    const { useListener } = require('web.custom_hooks');

    class ComboReplaceProductItemS extends PosComponent {
        constructor() {
            super(...arguments);
        }
        productClicked() {
            this.trigger('click-replace-product-item', { product: this.props.product});
        }
        get imageUrl() {
            const product = this.props.product;
            return `/web/image?model=product.product&field=image_128&id=${product.id}&write_date=${product.write_date}&unique=1`;
        }
        get hasVariant(){
            const product = this.props.product;
            return _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id);
        }
    }
    ComboReplaceProductItemS.template = 'ComboReplaceProductItemS';

    Registries.Component.add(ComboReplaceProductItemS);

    return ComboReplaceProductItemS;
});
