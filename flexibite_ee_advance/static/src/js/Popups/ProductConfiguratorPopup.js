odoo.define('flexibite_ee_advance.ProductConfiguratorPopup', function (require) {
    'use strict';

    const ProductConfiguratorPopup = require('point_of_sale.ProductConfiguratorPopup').ProductConfiguratorPopup;
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { useState, useRef} = owl.hooks;

    const AsplResProductConfiguratorPopup = (ProductConfiguratorPopup) =>
        class extends ProductConfiguratorPopup {
            constructor() {
                super(...arguments);
                this.switchStatus = useRef('switchStatus');
                this.state = useState({priceState : true})
                useListener('custom-order-screen', this._openCustomOrderScreen);
            }
            get currentOrder() {
                return this.env.pos.get_order();
            }
            async _openCustomOrderScreen() {
                var selected_attributes = [];
                var price_extra = 0.0;

                this.env.attribute_components.forEach((attribute_component) => {
                    let { value, extra } = attribute_component.getValue();
                    selected_attributes.push(value);
                    price_extra += extra;
                });
                var full_name = this.props.product.display_name;
                var description = selected_attributes.join(', ');
                var product = this.props.product;
                full_name += ` (${description})`;

                this._addBomLine(product);

                this.currentOrder.add_product(product, {
                    description: description,
                    price_extra: price_extra,
                    materiallines: this.currentOrder.get_materiallines(),
                    merge: false,
                });
                this.currentOrder.remove_all_materialline();
                this.showScreen('CustomOrderScreen', {
                    product: product,
                    price_extra: price_extra,
                    description: description,
                    full_name: full_name,
                    orderline: this.currentOrder.get_selected_orderline(),
                });

                this.trigger('close-popup');
            }
            _addBomLine(product){
                var order = this.currentOrder;
                var bom_line_data = order.get_bom_product_data_by_p_id(product.product_tmpl_id, product.bom_ids[product.bom_ids.length - 1]);
                for(var i = 0; i < bom_line_data.length; i++){
                    order.add_material(this.env.pos.db.get_product_by_id(bom_line_data[i]['id']), {
                        bom: true,
                        replaceable: bom_line_data[i]['replaceable'],
                        replaceable_ids: bom_line_data[i]['replaceable_ids'],
                        quantity: bom_line_data[i]['quantity'],
                        max: bom_line_data[i]['quantity'],
                        product_uom_id: bom_line_data[i]['product_uom_id'],
                        replaceable_by: bom_lines[i]['replaceable_by'],
                        replaceable_category_ids: bom_lines[i]['replaceable_category_ids'],
                        bom_base_price: bom_lines[i]['bom_base_price'],
                    });
                }
            }
            get hasBOM(){
                return this.props.product.bom_ids != 0;
            }
            getPayload() {
                var selected_attributes = [];
                var price_extra = 0.0;
                var priceState = this.state.priceState;

                this.env.attribute_components.forEach((attribute_component) => {
                    let { value, extra } = attribute_component.getValue();
                    selected_attributes.push(value);
                    price_extra += extra;
                });

                return {
                    selected_attributes,
                    price_extra,
                    priceState,
                };
            }
        };

    Registries.Component.extend(ProductConfiguratorPopup, AsplResProductConfiguratorPopup);

    return ProductConfiguratorPopup;
});
