odoo.define('flexibite_ee_advance.CreateComboScreen', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ControlButtonsMixin = require('point_of_sale.ControlButtonsMixin');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { onChangeOrder, useBarcodeReader } = require('point_of_sale.custom_hooks');
    const { useState, useRef } = owl.hooks;

    class CreateComboScreen extends ControlButtonsMixin(PosComponent) {

        constructor() {
            super(...arguments);
            useListener('add-product', this._addProduct);
            useListener('click-product', this._clickProduct);
            useListener('remove-comboline', this._removeComboLine);
            useListener('click-add', this._onClickAdd);
            useListener('click-plus', this._onClickPlus);
            useListener('click-minus', this._onClickMinus);
            useListener('click-reset', this._onClickReset);
            useListener('click-discard', this._onClickDiscard);
            useListener('click-save', this._onClickSave);
            useListener('click-delete', this._onClickDelete);
            useListener('click-back', this._onClickBack);
            useListener('click-split', this._onClickSplit);
            useListener('click-merge', this._onClickMerge);
            useListener('click-replace-product', this._onReplace);
            useListener('click-close-replacewidget', this._onCloseReplaceWidget);
            useListener('click-reset-product', this._onReset);
            useListener('click-category', this._selectCategory);
            useListener('click-ingredients', this._clickIngredients);
            useListener('click-customise-product', this._clickCustomiseProduct);
            useListener('click-flag', this._onClickFlag);
            useListener('select-line', this._lineSelected);
           this.state = useState({
                            editFlag: false,
                            onReplace: false,
                            replace_price:0,
                            mode:this.props.mode,
                            tempMode: false,
                            buttonEnable: {split: false, merge: false, plus: true, minus: true, remove: true}
                            });
            this.topRef = useRef('top');
            this.productWidget = useRef('productWidget');

        }
        mounted() {
            if(this.state.mode == 'new'){
                this._addRequiredCombolines(this.props.product);
                var orderline = this.currentOrder.get_selected_orderline();
                var price = orderline.get_lst_price();
                var price_extra = orderline.price_extra;
                var combolines = this.currentOrder.get_combolines();
                orderline.set_combolines(combolines);
                orderline.price_manually_set = true;
                orderline.set_unit_price(this.currentOrder.c_get_total_without_tax() + price + price_extra)
            }else if(this.state.mode == 'edit'){
                this._addSavedCombolines(this.props.orderline.combolines);
            }else if(this.state.mode == 'ongoing'){
            }
        }
        _addRequiredCombolines(product){
            var order = this.currentOrder;
            var requireLine = [];
            if(product){
                for(var i = 0; i < product.product_combo_ids.length; i++){
                    var line = this.env.pos.db.get_combo_line_by_id(product.product_combo_ids[i]);
                    if(line[2] == true){
                        requireLine.push(line);
                    }
                }
            }
            for(var i = 0; i < requireLine.length; i++){
                var productIds = requireLine[i][1];
                for(var j = 0; j < productIds.length; j++){
                    var comboProduct = this.env.pos.db.get_product_by_id(productIds[j]);
                    if(comboProduct.bom_ids.length != 0){
                        this._addBomLine(comboProduct);
                    }
                    order.add_combo_product(comboProduct, {
                        'categoryName': requireLine[i][4],
                        'categoryId': requireLine[i][0],
                        'quantity': requireLine[i][3],
                        'require': requireLine[i][2],
                        'replaceable': requireLine[i][7],
                        'basePrice': requireLine[i][8],
                        'max': requireLine[i][3],
                        'materiallines': this.currentOrder.get_materiallines(),
                    });
                }
            }
            this._changeButtonEnable();
        }
        _addSavedCombolines(combolines){
            for(var i = 0; i < combolines.length; i++){
                    var line = combolines[i];
                    this.currentOrder.add_combo_product(line.product, {
                        'categoryName': line.categoryName,
                        'categoryId': line.categoryId,
                        'quantity': line.quantity,
                        'require': line.require,
                        'replaceable': line.replaceable,
                        'basePrice': line.basePrice,
                        'max': line.max,
                        'materiallines_s': line.materiallines,
                        'merge' : false,
                        'replacePrice': line.replacePrice,
                        'customisePrice': line.customisePrice,
                        'is_replaced' : line.is_replaced,
                        'replaced_product_id' : line.replaced_product_id,
                    });
                }
            this._changeButtonEnable();
        }
        _addSplitComboline(comboline, qty, replaced){
            this.currentOrder.add_combo_product(comboline.product, {
                    'categoryName': comboline.categoryName,
                    'categoryId': comboline.categoryId,
                    'quantity': qty,
                    'require': comboline.require,
                    'replaceable': comboline.replaceable,
                    'basePrice': comboline.basePrice,
                    'max': comboline.max,
                    'is_replaced': comboline.is_replaced,
                    'replaced_product_id': comboline.replaced_product_id,
                    'materiallines_s': comboline.materiallines,
                    'merge' : false,
                    'replacePrice': comboline.replacePrice,
                    'customisePrice': comboline.customisePrice,
                });
        }
        _addSplitCombolineDefault(comboline, qty, replaced){
            var comboProduct = this.env.pos.db.get_product_by_id(comboline.product.id);
            if(comboProduct.bom_ids.length != 0){
                this._addBomLine(comboProduct);
            }
            this.currentOrder.add_combo_product(comboProduct, {
                    'categoryName': comboline.categoryName,
                    'categoryId': comboline.categoryId,
                    'quantity': qty,
                    'require': comboline.require,
                    'replaceable': comboline.replaceable,
                    'basePrice': comboline.basePrice,
                    'max': comboline.max,
                    'materiallines': this.currentOrder.get_materiallines(),
                    'merge' : false,
                });
        }
        _addBomLine(product){
            var bom_line_data = this.currentOrder.get_bom_product_data_by_p_id(product.product_tmpl_id, product.bom_ids[product.bom_ids.length - 1]);
            for(var i = 0; i < bom_line_data.length; i++){
                this.currentOrder.add_material(this.env.pos.db.get_product_by_id(bom_line_data[i]['id']), {
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
        _addCustomisedcomboline(){
            var combolines = this.props.orderline.combolines;
            if(combolines.length != 0){
                for(var i = 0; i < combolines.length; i++){
                    var comboline = combolines[i];
                    this.currentOrder.add_combo(comboline.product,{
                         bom: comboline.bom,
                         quantity: comboline.quantity,
                         replaceable: comboline.replaceable,
                         replaceable_ids: comboline.replaceable_ids,
                         is_replaced: comboline.is_replaced,
                         replaced_product_id: comboline.replaced_product_id,
                    });
                }
            }
            this._changeButtonEnable();
        }
        _onClickAdd(){
            var orderline = this.currentOrder.get_selected_orderline();
            orderline.set_quantityLine(this.productWidget.comp.state.quantityLine);
            orderline.set_useQuantityLine(this.productWidget.comp.state.useQuantityLine);
            var price = orderline.get_lst_price();
            var price_extra = orderline.price_extra;
            var combolines = this.currentOrder.get_combolines();
            orderline.set_combolines([]);
            orderline.set_combolines(combolines);
            orderline.price_manually_set = true;
            orderline.set_unit_price(this.currentOrder.c_get_total_without_tax() + price + price_extra)
            this.currentOrder.remove_all_comboline();
            this.showScreen('ProductScreen');
        }
        _onClickPlus(){
            this.topRef.comp.scrollableRef.el.scrollTop  = this.topRef.comp.state.top;
            var line = this.currentOrder.get_selected_comboline();

            if(!line.require){
                const max = this.env.pos.db.get_combo_line_by_id(line.categoryId)[3];
                const use = this.productWidget.comp.state.useQuantityLine[[line.categoryId]];
                const productId = line.product.id;
                if(use < max){
                    this.productWidget.comp.state.useQuantityLine[line.categoryId] += 1;
                    this.productWidget.comp.state.quantityLine[line.categoryId][productId] += 1;
                    this._setValue('+');
                }
            }else if(line.require){
                if(line.max > line.quantity){
                    this._setValue('+');
                }
            }
            this._changeButtonEnable();
        }
        _onClickMinus(){
            this.topRef.comp.scrollableRef.el.scrollTop  = this.topRef.comp.state.top - 20;
            var line = this.currentOrder.get_selected_comboline();
            if(!line.require){
                const use = this.productWidget.comp.state.useQuantityLine[[line.categoryId]];
                const productId = line.product.id;
                if(use != 0){
                    this.productWidget.comp.state.useQuantityLine[line.categoryId] -= 1;
                    this.productWidget.comp.state.quantityLine[line.categoryId][productId] -= 1;
                    this._setValue('-');
                }
            }else if(line.require){
                if(line.quantity != 0){
                    this._setValue('-require');
                }
            }
            this._changeButtonEnable();
        }
        async _onClickReset(){
            const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                    title: 'Reset',
                    body: 'Do you want Reset Combo Products?',
                    cancelText: 'No',
                    confirmText: 'Yes',
                });
            if (confirmedPopup){
                this.state.editFlag = true;
                this.currentOrder.remove_all_comboline();
                this._addRequiredCombolines(this.props.product);
                this.productWidget.comp.state.quantityLine = {};
                this.productWidget.comp.state.useQuantityLine = {};
            }
        }
        _onClickDiscard(){
            if(this.state.editFlag == true){
                this.state.editFlag = false;
                this.currentOrder.remove_all_comboline();
                var orderline = this.currentOrder.get_selected_orderline();
                var combolines = orderline.combolines;
                this.productWidget.comp.state.quantityLine = JSON.parse(JSON.stringify(orderline.quantityLine));
                this.productWidget.comp.state.useQuantityLine = JSON.parse(JSON.stringify(orderline.useQuantityLine));
                this._addSavedCombolines(combolines);
            }
        }
        async _onClickSplit(){
            this.state.editFlag = false;
            var comboline = this.currentOrder.get_selected_comboline();
            if(comboline.materiallines.length != 0 && comboline.quantity > 1 && comboline.is_replaced == false){
                const { confirmed: confirmedPopup, defaultCopy: defaultCopy, payload: payload, } = await this.showPopup('SplitCombolinePopup', {
                        title: comboline.product.display_name,
                        cheap: comboline.quantity > 5 ? false : true,
                    });
                if (confirmedPopup){
                    var currentQty = comboline.quantity;
                    var currentMax = comboline.max;
                    if(currentQty > payload && payload != 0){
                        this.state.editFlag = true;
                        comboline.set_quantity(currentQty - payload);
                        if(comboline.require == true){
                            comboline.set_max(currentMax - payload);
                        }
                        this._addSplitComboline(comboline, payload);
                    }else{
                        alert('Wrong input!!')
                    }
                }
                if (defaultCopy){
                    var currentQty = comboline.quantity;
                    var currentMax = comboline.max;
                    if(currentQty > payload && payload != 0){
                        this.state.editFlag = true;
                        comboline.set_quantity(currentQty - payload);
                        if(comboline.require == true){
                            comboline.set_max(currentMax - payload);
                        }
                        this._addSplitCombolineDefault(comboline, payload);
                    }else{
                        alert('Wrong input!!')
                    }
                }
            }
            else if(comboline.replaceable && comboline.quantity > 1 && comboline.is_replaced == false){
                const { confirmed: confirmedPopup, defaultCopy: defaultCopy, payload: payload, } = await this.showPopup('SplitCombolinePopup', {
                        title: comboline.product.display_name,
                        cheap: comboline.quantity > 5 ? false : true,
                        mode: 'simple',
                    });
                if (confirmedPopup){
                    var currentQty = comboline.quantity;
                    var currentMax = comboline.max;
                    if(currentQty > payload && payload != 0){
                        this.state.editFlag = true;
                        comboline.set_quantity(currentQty - payload);
                        if(comboline.require == true){
                            comboline.set_max(currentMax - payload);
                        }
                        this._addSplitCombolineDefault(comboline, payload);
                    }else{
                        alert('Wrong input!!')
                    }
                }
            }
            else if(comboline.quantity > 1 && comboline.is_replaced){
                const { confirmed: confirmedPopup, defaultCopy: defaultCopy, payload: payload, } = await this.showPopup('SplitCombolinePopup', {
                        title: comboline.product.display_name,
                        cheap: comboline.quantity > 5 ? false : true,
                        mode: 'simple',
                    });
                if (confirmedPopup){
                    var currentQty = comboline.quantity;
                    var currentMax = comboline.max;
                    if(currentQty > payload && payload != 0){
                        this.state.editFlag = true;
                        comboline.set_quantity(currentQty - payload);
                        if(comboline.require == true){
                            comboline.set_max(currentMax - payload);
                        }
                        this._addSplitComboline(comboline, payload, true);
                    }else{
                        alert('Wrong input!!')
                    }
                }
            }
            this._changeButtonEnable();
        }
        async _onClickMerge(){
            this.state.editFlag = false;
            var remainingCombolines = this.currentOrder.get_remaining_comboline(this.currentLine)
            const { confirmed: confirmedPopup, payload: payload, } = await this.showPopup('MergeCombolinePopup', {
                    title: this.currentLine.product.display_name,
                    currentLine: this.currentLine,
                    list: remainingCombolines,
                });
            var currentLine = this.currentLine;
            if (confirmedPopup){
                this.state.editFlag = true;
                var qty = this.currentLine.quantity;
                for(var i=0; i < remainingCombolines.length; i++){
                    var line = remainingCombolines[i];
                    if(payload[line.cid] == true){
                        this.currentOrder.remove_comboline(line);
                        qty += line.quantity
                    }
                }
                currentLine.set_quantity(qty)
            }
            this._changeButtonEnable();
        }
        _onClickSave(){
            this.state.editFlag = false;
            var orderline = this.currentOrder.get_selected_orderline();
            orderline.set_quantityLine(this.productWidget.comp.state.quantityLine);
            orderline.set_useQuantityLine(this.productWidget.comp.state.useQuantityLine);
            var price = orderline.get_lst_price();
            var price_extra = orderline.price_extra;
            var combolines = this.currentOrder.get_combolines();
            orderline.set_combolines([]);
            orderline.set_combolines(combolines);
            orderline.price_manually_set = true;
            orderline.set_unit_price(this.currentOrder.m_get_total_without_tax() + price + price_extra)
        }
        _onClickDelete(){
            var comboline = this.currentOrder.get_selected_comboline();
            if(comboline.require == false){
                const id = comboline.categoryId;
                const qty = comboline.quantity;
                const productId = comboline.product.id;
                this.productWidget.comp.state.selectedComboCategoryId = id;
                this.productWidget.comp.state.quantityLine[id][productId] -= qty;
                this.productWidget.comp.state.useQuantityLine[id] -= qty;
                this.currentOrder.deselect_comboline();
                comboline.set_quantity('remove');
                this.state.editFlag = true;

            }else if(comboline.require == true && comboline.quantity != 0){
                comboline.set_quantity(0);
                this.state.editFlag = true;
            }
            this._changeButtonEnable();
        }
        _selectCategory(event){
            this.productWidget.comp.state.selectedComboCategoryId = event.detail.comboline.categoryId;
        }
        async _onClickBack(){
            if(this.state.editFlag == true){
                const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                        title: 'Cart Is Unsaved',
                        body: 'Do you want to save cart?',
                        cancelText: 'No',
                        confirmText: 'Yes',
                    });
                if (confirmedPopup){
                    this._onClickSave();
                }
                this.currentOrder.remove_all_comboline();
                this.showScreen('ProductScreen');
            }else{
                this.currentOrder.remove_all_comboline();
                this.showScreen('ProductScreen');
            }
        }
        _setValue(val,line) {
            var order = this.currentOrder;
            var selected_comboline = order.get_selected_comboline();
            if (selected_comboline) {
                if(val == '+'){
                    var quantity = selected_comboline.quantity + 1;
                    this.state.editFlag = true;
                    selected_comboline.set_quantity(quantity);
                }else if(val == '+bom'){
                    selected_comboline.set_quantity(1);
                }else if(val == '-require'){
                    var quantity = selected_comboline.quantity - 1;
                    this.state.editFlag = true;
                    selected_comboline.set_quantity(quantity);
                    if(selected_comboline.quantity == 0){
                        selected_comboline.is_replaced = false;
                    }
                }else if(val == '-'){
                    if(selected_comboline.quantity != 0){
                        var quantity = selected_comboline.quantity - 1;
                        selected_comboline.set_quantity(quantity);
                        this.state.editFlag = true;
                        if(selected_comboline.quantity == 0){
                            selected_comboline.set_quantity('remove');
                        }
                    }else{
                        selected_comboline.set_quantity('remove');
                    }
                }else if(val == 'clear'){
                    if(line.quantity != 0){
                        var quantity = line.quantity - 1;
                        line.set_quantity(quantity);
                        this.state.editFlag = true;
                        if(line.quantity == 0){
                            line.set_quantity('remove');
                        }
                    }else{
                        line.set_quantity('remove');
                        this.state.editFlag = true;
                    }
                }
            }
        }
        get currentOrder() {
            return this.env.pos.get_order();
        }
        get currentLine() {
            return this.currentOrder.get_selected_comboline();
        }
        get optionalPlus(){
            const max = this.env.pos.db.get_combo_line_by_id(this.currentLine.categoryId)[3];
            const use = this.productWidget.comp.state.useQuantityLine[[this.currentLine.categoryId]];
            return use == max ? true : false;
        }
        _addProduct(event) {
            this.state.editFlag = true;
            const product = event.detail.product;
            const categoryName =  event.detail.categoryName;
            const categoryId =  event.detail.categoryId;
            const require =  event.detail.require;
            const replaceable =  event.detail.replaceable;
            const basePrice =  event.detail.basePrice;
            if(product.bom_ids.length != 0){
                this._addBomLine(product);
            }
            this.currentOrder.add_combo_product(product,{
                'categoryName': categoryName,
                'categoryId': categoryId,
                'require': require,
                'replaceable': replaceable,
                'basePrice': basePrice,
                'materiallines': this.currentOrder.get_materiallines(),
            });
            this._changeButtonEnable();
        }
        async _removeComboLine(event){
            var line = this.currentOrder.get_comboline(event.detail.categoryId,event.detail.product.id);
            this.currentOrder.select_comboline(line);
//            this.topRef.comp.scrollableRef.el.scrollTop = 100; //improve this scrolling on delete product from rightpan

            this._setValue('clear',line);
            this.render();
        }
        _onClickFlag(){
            this.state.editFlag = true;
            this._changeButtonEnable();
        }
        async _clickProduct(event){
            var difference = event.detail.lst_price - this.state.replace_price;
            difference = this.currentOrder.get_replace_price_difference(difference);
            if(difference < 0){
                difference = 0;
            }
            const { confirmed: confirmedPopup } = await this.showPopup('ConfirmPopup', {
                    title: event.detail.display_name,
                    body: this.env.pos.format_currency(difference) + ' is the price difference. Do you want to replace product?',
                });
            if (confirmedPopup){
                this.state.editFlag = true;
                this.state.onReplace = false;
                var line = this.currentOrder.get_selected_comboline();
                line.set_replaced_product_id(event.detail.id);
                line.set_is_replaced(true);
                line.set_customisePrice(0);
                line.set_replacePrice(difference);
                line.set_materiallines([]);
                var new_product = this.env.pos.db.get_product_by_id(event.detail.id);
                if(new_product.bom_ids.length != 0){
                    this._addBomLine(new_product);
                    line.set_materiallines(this.currentOrder.get_materiallines());
                    this.currentOrder.remove_all_materialline();
                }

            }
            if (!confirmedPopup){
                this.state.editFlag = true;
                this.state.onReplace = false;
            }
            this.topRef.comp._updateSummary()
        }
        _onReplace(event){
            this.state.tempMode = true;
            this.currentOrder.select_comboline(event.detail.comboline);
            this.currentOrder.set_quantityLine(this.productWidget.comp.state.quantityLine);
            this.currentOrder.set_useQuantityLine(this.productWidget.comp.state.useQuantityLine);
            this.state.replace_price = event.detail.comboline.basePrice;
            this.state.onReplace = true;
        }
        _onReset(event){
            this.state.editFlag = true;
            var line = event.detail.comboline;
            this.currentOrder.select_comboline(line);
            line.set_is_replaced(false);
            line.set_replacePrice(0);
            line.set_customisePrice(0);
            line.set_replaced_product_id(null);
            this._addBomLine(line.product);
            line.set_materiallines([]);
            line.set_materiallines(this.currentOrder.get_materiallines());
            this.currentOrder.remove_all_materialline();
            this.render();
        }
        async _clickIngredients(event){
            const { confirmed } = await this.showPopup(
                'MaterialInfoPopup',
                {
                    title: event.detail.comboline.product.display_name,
                    list: event.detail.comboline.materiallines,
                }
            );
        }
        _clickCustomiseProduct(event){
            const comboline = event.detail.comboline;
            this.currentOrder.get_selected_orderline().set_quantityLine(this.productWidget.comp.state.quantityLine);
            this.currentOrder.get_selected_orderline().set_useQuantityLine(this.productWidget.comp.state.useQuantityLine);
            if(comboline.is_replaced){
                var product = this.env.pos.db.get_product_by_id(comboline.replaced_product_id);
            }else{
                var product = comboline.product;
            }
            this.showScreen('ComboCustomiseProductScreen', {
                product: product,
                comboline: comboline,
                orderline: this.currentOrder.get_selected_orderline(),
                full_name: product.display_name,
                edit: true,
                mode: 'combo',
            });
        }
        _onCloseReplaceWidget(){
            this.state.onReplace = false;
        }

        _lineSelected(){
            this._changeButtonEnable();
        }
        _changeButtonEnable(){
            if(this.currentLine){
                if(this.currentLine.quantity > 1 && (this.currentLine.materiallines.length != 0 || this.currentLine.replaceable)){
                    this.state.buttonEnable.split = true;
                }else{
                    this.state.buttonEnable.split = false;
                }
                if(this.currentLine.materiallines.length != 0 && this.currentOrder.get_remaining_comboline(this.currentLine).length != 0){
                    this.state.buttonEnable.merge = true;
                }else{
                    this.state.buttonEnable.merge = false;
                }
                if(this.currentLine.max == this.currentLine.quantity && this.currentLine.require){
                    this.state.buttonEnable.plus = false;
                }else if(this.optionalPlus && !this.currentLine.require){
                    this.state.buttonEnable.plus = false;
                }else{
                    this.state.buttonEnable.plus = true;
                }
                if(this.currentLine.quantity == 0 && this.currentLine.require){
                    this.state.buttonEnable.minus = false;
                    this.state.buttonEnable.remove = false;
                }else{
                    this.state.buttonEnable.minus = true;
                    this.state.buttonEnable.remove = true;
                }
            }
        }
    }
    CreateComboScreen.template = 'CreateComboScreen';

    Registries.Component.add(CreateComboScreen);

    return CreateComboScreen;

});
