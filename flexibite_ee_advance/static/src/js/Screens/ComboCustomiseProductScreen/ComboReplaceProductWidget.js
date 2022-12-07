odoo.define('flexibite_ee_advance.ComboReplaceProductWidget', function(require) {
    'use strict';

    const { useState } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class ComboReplaceProductWidget extends PosComponent {
        constructor() {
            super(...arguments);

            this.state = useState({
            });
        }
        mounted() {
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
    ComboReplaceProductWidget.template = 'ComboReplaceProductWidget';

    Registries.Component.add(ComboReplaceProductWidget);

    return ComboReplaceProductWidget;
});
