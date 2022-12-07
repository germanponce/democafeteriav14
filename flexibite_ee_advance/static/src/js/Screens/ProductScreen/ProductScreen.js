odoo.define('flexibite_ee_advance.ProductScreen', function(require) {
    'use strict';

    const ProductScreen = require('point_of_sale.ProductScreen')
    const PosComponent = require('point_of_sale.PosComponent');
    const ControlButtonsMixin = require('point_of_sale.ControlButtonsMixin');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { onChangeOrder, useBarcodeReader } = require('point_of_sale.custom_hooks');
    const { useState } = owl.hooks;
    var core = require('web.core');
    var _t = core._t;


    const AsplResProductScreen = ProductScreen =>
        class extends ProductScreen {
            constructor() {
                super(...arguments);
                useListener('set-order-type-mode', this._setOrderTypeMode);
                useListener('is_packaging', this.is_packaging_product);
                this.state.isPackaging = false
            }
            is_packaging_product(event) {
                if (this.state.isPackaging === false){
                    this.state.isPackaging = true
                    this.env.pos.set('selectedCategoryId', 0);
                }else{
                    this.state.isPackaging = false
                }
                this.props.products = event.detail
            }
            get productsToDisplay() {
                return this.props.products
                // super.productsToDisplay
              }
            _setOrderTypeMode(event) {
                const { mode } = event.detail;
                this.state.orderTypeMode = mode;
            }

            _onClickPay() {
                if(this.env.pos.user && this.env.pos.user.kitchen_screen_user === 'waiter'){
                    this.env.pos.db.notification('danger',_t('You do not have a rights of payment!'));
                }else{
                    this.showScreen('PaymentScreen');
                }
            }

            async _clickProduct(event) {
                if (!this.currentOrder) {
                    this.env.pos.add_new_order();
                }
                const product = event.detail;
                let price_extra = 0.0;
                let draftPackLotLines, weight, description, packLotLinesToEdit;

                if (this.env.pos.config.product_configurator && _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
                    let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
                                      .filter((attr) => attr !== undefined);
                    let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
                        product: product,
                        attributes: attributes,
                    });

                    if (confirmed) {
                        description = payload.selected_attributes.join(', ');
                        price_extra += payload.price_extra;
                    } else {
                        return;
                    }
                }
                // Gather lot information if required.
                if (['serial', 'lot'].includes(product.tracking)) {
                    const isAllowOnlyOneLot = product.isAllowOnlyOneLot();
                    if (isAllowOnlyOneLot) {
                        packLotLinesToEdit = [];
                    } else {
                        const orderline = this.currentOrder
                            .get_orderlines()
                            .filter(line => !line.get_discount())
                            .find(line => line.product.id === product.id);
                        if (orderline) {
                            packLotLinesToEdit = orderline.getPackLotLinesToEdit();
                        } else {
                            packLotLinesToEdit = [];
                        }
                    }
                    const { confirmed, payload } = await this.showPopup('EditListPopup', {
                        title: this.env._t('Lot/Serial Number(s) Required'),
                        isSingleItem: isAllowOnlyOneLot,
                        array: packLotLinesToEdit,
                    });
                    if (confirmed) {
                        // Segregate the old and new packlot lines
                        const modifiedPackLotLines = Object.fromEntries(
                            payload.newArray.filter(item => item.id).map(item => [item.id, item.text])
                        );
                        const newPackLotLines = payload.newArray
                            .filter(item => !item.id)
                            .map(item => ({ lot_name: item.text }));

                        draftPackLotLines = { modifiedPackLotLines, newPackLotLines };
                    } else {
                        // We don't proceed on adding product.
                        return;
                    }
                }
                // Take the weight if necessary.
                if (product.to_weight && this.env.pos.config.iface_electronic_scale) {
                    // Show the ScaleScreen to weigh the product.
                    if (this.isScaleAvailable) {
                        const { confirmed, payload } = await this.showTempScreen('ScaleScreen', {
                            product,
                        });
                        if (confirmed) {
                            weight = payload.weight;
                        } else {
                            // do not add the product;
                            return;
                        }
                    } else {
                        await this._onScaleNotAvailable();
                    }
                }
                if(product.is_combo){
                    this._clickCombo(product);
                    var is_merge = false;
                }

                if(product.bom_ids.length != 0){
                    this._addBomLine(product);
                    var is_merge = false;
                }
                // Add the product after having the extra information.
                this.currentOrder.add_product(product, {
                    draftPackLotLines,
                    description: description,
                    price_extra: price_extra,
                    quantity: weight,
                    materiallines: this.currentOrder.get_materiallines(),
                    merge: is_merge,
                });
                this.currentOrder.remove_all_materialline();

                NumberBuffer.reset();

            }
            _addBomLine(product){
                var order = this.env.pos.get_order();
                var bom_line_data = order.get_bom_product_data_by_p_id(product.product_tmpl_id, product.bom_ids[product.bom_ids.length - 1]);
                for(var i = 0; i < bom_line_data.length; i++){
                    order.add_material(this.env.pos.db.get_product_by_id(bom_line_data[i]['id']), {
                         bom: true,
                         replaceable: bom_line_data[i]['replaceable'],
                         replaceable_ids: bom_line_data[i]['replaceable_ids'],
                         quantity: bom_line_data[i]['quantity'],
                         max: bom_line_data[i]['quantity'],
                         product_uom_id: bom_line_data[i]['product_uom_id'],
                         replaceable_by: bom_line_data[i]['replaceable_by'],
                         replaceable_category_ids: bom_line_data[i]['replaceable_category_ids'],
                         bom_base_price: bom_line_data[i]['bom_base_price'],
                    });
                }
            }
            _clickCombo(product){
                this.showScreen('CreateComboScreen', {
                        product:product,
                        mode: 'new',
                    });
            }
            async _setValue(val){
                let line = this.currentOrder.get_selected_orderline();
                if(line === undefined){
                    super._setValue(...arguments);
                    return;
                }

                let remove = false;
                let qty = 0;
                if(line.state != 'Waiting' && this.state.numpadMode === 'quantity'){
                    alert('You can not change the quantity!')
                }else{
                    if(line.state == 'Waiting' && line.mo_id && this.state.numpadMode === 'quantity'){
                        if(val == 'remove'){
                            remove = true;
                        }else if(val == ''){
                            qty = 0;
                        }else{
                            qty = val;
                        }
                        await this.rpc({
                            model: 'pos.order',
                            method: 'remove_mo',
                            args: [{'mo_id': line.mo_id,
                                    'qty': val, 'remove': remove }],
                        });
                    }
                    super._setValue(...arguments);
                }
                if(this.env.pos.config.customer_display && this.currentOrder){
                    this.currentOrder.mirror_image_data();
                }
            }
        };

    Registries.Component.extend(ProductScreen, AsplResProductScreen);

    return ProductScreen;
});
