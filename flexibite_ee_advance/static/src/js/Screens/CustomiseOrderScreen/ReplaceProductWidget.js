odoo.define('flexibite_ee_advance.ReplaceProductWidget', function(require) {
    'use strict';

    const { useState } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class ReplaceProductWidget extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({});
        }
        mounted() {
        }
        get categoryProducts(){
            return this.env.pos.db.get_product_by_category(this.props.selected_id)
        }
        get productsToDisplay() {
            const materialline = this.currentOrder.get_selected_materialline();
            var replaceable_ids = materialline.replaceable_ids;
            var list = [];
            for(var i = 0; i < replaceable_ids.length; i++){
                list.push(this.env.pos.db.get_product_by_id(replaceable_ids[i]));
            }
            return list;
        }
        get currentOrder(){
            return this.env.pos.get_order();
        }

    }
    ReplaceProductWidget.template = 'ReplaceProductWidget';

    Registries.Component.add(ReplaceProductWidget);

    return ReplaceProductWidget;
});
