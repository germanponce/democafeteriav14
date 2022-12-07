odoo.define('flexibite_ee_advance.ComboProductItem', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;
    const { useListener } = require('web.custom_hooks');

    class ComboProductItem extends PosComponent {
        constructor() {
            super(...arguments);
        }
        productClicked() {
            this.trigger('click-combo-product', { product: this.props.product});
        }
        clearClicked() {
            this.trigger('click-clear', { product: this.props.product});
        }
        get imageUrl() {
            const product = this.props.product;
            return `/web/image?model=product.product&field=image_128&id=${product.id}&write_date=${product.write_date}&unique=1`;
        }
        get quantity(){
            return this.props.productQuantityLine ? this.props.productQuantityLine[this.props.product.id] : 0;
        }
    }
    ComboProductItem.template = 'ComboProductItem';

    Registries.Component.add(ComboProductItem);

    return ComboProductItem;
});
