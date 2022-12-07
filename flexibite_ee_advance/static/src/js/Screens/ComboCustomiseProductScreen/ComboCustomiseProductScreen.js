odoo.define('flexibite_ee_advance.ComboCustomiseProductScreen', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ControlButtonsMixin = require('point_of_sale.ControlButtonsMixin');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { onChangeOrder, useBarcodeReader } = require('point_of_sale.custom_hooks');
    const { useState } = owl.hooks;

    class ComboCustomiseProductScreen extends ControlButtonsMixin(PosComponent) {

        constructor() {
            super(...arguments);
            useListener('click-product', this._clickProduct);
            useListener('click-add', this._onClickAdd);
            useListener('click-plus', this._onClickPlus);
            useListener('click-minus', this._onClickMinus);
            useListener('click-reset', this._onClickReset);
            useListener('click-discard', this._onClickDiscard);
            useListener('click-save', this._onClickSave);
            useListener('click-delete', this._onClickDelete);
            useListener('click-back', this._onClickBack);
            useListener('click-replace-product', this._clickReplaceProduct);
            useListener('click-reset-product', this._onClickFlag);
            useListener('click-replace-product-item', this._clickReplaceProductItem);
            useListener('click-close-replacewidget', this._onCloseReplaceWidget);
            useListener('select-line', this._lineSelected);
            this.state = useState({
                editFlag: false,
                mode: this.props.mode,
                replaceMode: false,
                buttonEnable: {plus: true, minus: true, remove: true}
            });

        }
        mounted() {
            this._addCustomisedMaterialline();
        }
        _addBomLine(product){
            var order = this.currentOrder;
            if(product){
                var bom_line_data = order.get_bom_product_data_by_p_id(product.product_tmpl_id, product.bom_ids[product.bom_ids.length - 1]);
            }else{
                var bom_line_data =order.get_bom_product_data_by_p_id(this.props.product.product_tmpl_id, this.props.product.bom_ids[this.props.product.bom_ids.length - 1]);
            }
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
            this._changeButtonEnable();
        }
        _addCustomisedMaterialline(){
            var materiallines = this.props.comboline.materiallines;
            if(materiallines.length != 0){
                for(var i = 0; i < materiallines.length; i++){
                    var materialline = materiallines[i];
                    this.currentOrder.add_material(materialline.product,{
                         bom: materialline.bom,
                         quantity: materialline.quantity,
                         replaceable: materialline.replaceable,
                         replaceable_ids: materialline.replaceable_ids,
                         is_replaced: materialline.is_replaced,
                         replaced_product_id: materialline.replaced_product_id,
                         max: materialline.max,
                         description: materialline.description,
                         price_extra: materialline.price_extra,
                    });
                }
            }
            this._changeButtonEnable();
        }
        _onClickAdd(){
            var materiallines = this.currentOrder.get_materiallines();
            this.props.comboline.set_materiallines([]);
            this.props.comboline.set_materiallines(materiallines);
            this.props.comboline.set_customisePrice(this.currentOrder.m_get_total_without_tax())
            this.currentOrder.remove_all_materialline();
            const orderline = this.props.orderline;
            this.showScreen('CreateComboScreen', {
                product: orderline.product,
                orderline: orderline,
                full_name: orderline.get_full_product_name(),
                edit: true,
                mode: 'ongoing',
            });
        }
        _onClickPlus(){
            if(!this.currentOrder.get_selected_materialline().bom){
                this._setValue('+');
            }else{
                this._setValue('+bom');
            }
            this._changeButtonEnable();
        }
        _onClickMinus(){
            if(!this.currentOrder.get_selected_materialline().bom){
                this._setValue('-');
            }else{
                this._setValue('-bom');
            }
            this._changeButtonEnable();
        }
        async _onClickReset(){
            const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                    title: 'Reset Material',
                    body: 'Do you want default material?',
                });
            if (confirmedPopup){
                this.state.editFlag = true;
                this.currentOrder.remove_all_materialline();
                this._addBomLine();
            }
        }
        _onClickDiscard(){
            this.state.editFlag = false;
            this.currentOrder.remove_all_materialline();
            this._addCustomisedMaterialline();

        }
        _onClickSave(){
            this.state.editFlag = false;
            var materiallines = this.currentOrder.get_materiallines();
            this.props.comboline.set_materiallines([]);
            this.props.comboline.set_materiallines(materiallines);
            this.props.comboline.set_customisePrice(this.currentOrder.m_get_total_without_tax())
        }
        _onClickDelete(){
            var materialline = this.currentOrder.get_selected_materialline();
            if(materialline.bom == true && materialline.quantity != 0){
                materialline.set_quantity(0);
                materialline.is_replaced = false;
                this.state.editFlag = true;
            }else if(materialline.bom == false){
                materialline.set_quantity('remove');
                this.state.editFlag = true;
            }
            this._changeButtonEnable();
        }
        async _onClickBack(){
            if(this.state.editFlag == true){
                const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                        title: 'Changes Are Unsaved',
                        body: 'Do you want to save changes?',
                        cancelText: 'No',
                        confirmText: 'Yes',
                    });
                if (confirmedPopup){
                    this._onClickSave();
                }
                this.currentOrder.remove_all_materialline();
                const orderline = this.props.orderline;
                this.showScreen('CreateComboScreen', {
                    product: orderline.product,
                    orderline: orderline,
                    full_name: orderline.get_full_product_name(),
                    edit: true,
                    mode: 'ongoing',
                });
            }else{
                this.currentOrder.remove_all_materialline();
                const orderline = this.props.orderline;
                this.showScreen('CreateComboScreen', {
                    product: orderline.product,
                    orderline: orderline,
                    full_name: orderline.get_full_product_name(),
                    edit: true,
                    mode: 'ongoing',
                });
            }
        }
        _onClickFlag(){
            this.state.editFlag = true;
            this._changeButtonEnable();
        }
        _setValue(val) {
            var order = this.currentOrder;
            var selected_materialline = order.get_selected_materialline();
            var quantity = selected_materialline.quantity;
            if (selected_materialline) {
                if(val == '+'){
                    selected_materialline.set_quantity(quantity + 1);
                    this.state.editFlag = true;
                }else if(val == '+bom'){
                    if(selected_materialline.max > quantity){
                        selected_materialline.set_quantity(quantity + 1);
                        this.state.editFlag = true;
                    }
                }else if(val == '-bom'){
                    if(quantity != 0){
                        selected_materialline.set_quantity(quantity - 1);
                        this.state.editFlag = true;
                        if(selected_materialline.quantity == 0){
                            selected_materialline.is_replaced = false;
                            selected_materialline.set_description('');
                            selected_materialline.set_unit_price(0);
                            selected_materialline.set_price_extra(0);
                        }
                    }
                }else{
                    if(quantity != 0){
                        selected_materialline.set_quantity(quantity - 1);
                        this.state.editFlag = true;
                        if(selected_materialline.quantity == 0){
                            selected_materialline.set_quantity('remove');
                        }
                    }
                }
            }
        }
        get currentOrder() {
            return this.env.pos.get_order();
        }
        get currentLine() {
            return this.currentOrder.get_selected_materialline();
        }
        async _clickProduct(event) {
            this.state.editFlag = true;
            const product = event.detail;
            let price_extra = 0.0;
            let description;

            if (this.env.pos.config.product_configurator && _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
                let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
                                  .filter((attr) => attr !== undefined);
                let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
                    product: product,
                    attributes: attributes,
                    mode: 'material',
                });

                if (confirmed) {
                    description = payload.selected_attributes.join(', ');
                    price_extra += payload.price_extra;
                } else {
                    return;
                }
            }
            this.currentOrder.add_material(product, {
                description: description,
                price_extra: price_extra,
            });
            this._changeButtonEnable();
        }
        async _clickReplaceProduct(event){
            this.currentOrder.select_materialline(event.detail.materialline);
            this.state.editFlag = true;
            this.state.replaceMode = true;
            if(this.state.replaceMode){
                this.state.replaceMode = false;
                this.state.replaceMode = true;
            }
            this._changeButtonEnable();
        }
        async _clickReplaceProductItem(event){
            const product = event.detail.product;
            let price_extra = 0.0;
            let description;

            if (this.env.pos.config.product_configurator && _.some(product.attribute_line_ids, (id) => id in this.env.pos.attributes_by_ptal_id)) {
                let attributes = _.map(product.attribute_line_ids, (id) => this.env.pos.attributes_by_ptal_id[id])
                                  .filter((attr) => attr !== undefined);
                let { confirmed, payload } = await this.showPopup('ProductConfiguratorPopup', {
                    product: product,
                    attributes: attributes,
                    mode: 'replace'
                });

                if (confirmed) {
                    description = payload.selected_attributes.join(', ');
                    price_extra += payload.price_extra;
                    this.state.editFlag = true;
                    this.state.replaceMode = false;
                    var line = this.currentOrder.get_selected_materialline();
                    line.set_replaced_product_id(product.id);
                    if(line.quantity == 0){
                        line.set_quantity(1);
                    }
                    line.set_is_replaced(true);
                    line.set_description(description);
                    if(payload.priceState){
                        line.set_unit_price(price_extra);
                        line.set_price_extra(price_extra);
                    }
                } else {
                    this.state.replaceMode = false;
                    return;
                }
            }else{
                const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                        title: product.display_name,
                        body: 'Do you want to replace product?',
                    });
                if (confirmedPopup){
                    this.state.editFlag = true;
                    this.state.replaceMode = false;
                    var line = this.currentOrder.get_selected_materialline();
                    line.set_replaced_product_id(product.id);
                    if(line.quantity == 0){
                        line.set_quantity(1);
                    }
                    line.set_is_replaced(true);
                    line.set_description('');
                    line.set_unit_price(0);
                    line.set_price_extra(0);

                }
                if (!confirmedPopup){
                    this.state.replaceMode = false;
                }
            }
        }
        _onCloseReplaceWidget(){
            this.state.replaceMode = false;
        }
        _lineSelected(){
            this._changeButtonEnable();
        }
        _changeButtonEnable(){
            if(this.currentLine.max == this.currentLine.quantity && this.currentLine.bom){
                this.state.buttonEnable.plus = false;
            }else{
                this.state.buttonEnable.plus = true;
            }
            if(this.currentLine.quantity == 0 && this.currentLine.bom){
                this.state.buttonEnable.minus = false;
                this.state.buttonEnable.remove = false;
            }else{
                this.state.buttonEnable.minus = true;
                this.state.buttonEnable.remove = true;
            }
        }

    }
    ComboCustomiseProductScreen.template = 'ComboCustomiseProductScreen';

    Registries.Component.add(ComboCustomiseProductScreen);

    return ComboCustomiseProductScreen;

});
