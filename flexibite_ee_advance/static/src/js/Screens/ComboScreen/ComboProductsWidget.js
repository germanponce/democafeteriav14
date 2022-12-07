odoo.define('flexibite_ee_advance.ComboProductsWidget', function(require) {
    'use strict';

    const { useState } = owl.hooks;
    const PosComponent = require('point_of_sale.PosComponent');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class ComboProductsWidget extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('switch-category', this._switchCategory);
            useListener('click-combo-product', this._clickProduct);
            useListener('click-clear', this._clickClear);

            this.state = useState({
                selectedComboCategoryId: this.categories[0].id,
                quantityLine: JSON.parse(JSON.stringify(this.currentOrder.get_selected_orderline().get_quantityLine())),
                useQuantityLine:JSON.parse(JSON.stringify(this.currentOrder.get_selected_orderline().get_useQuantityLine())),
            });

        }
        mounted() {
            this.state.selectedComboCategoryId = this.categories[0].id;
            if(this.props.tempMode){
                this.state.quantityLine = JSON.parse(JSON.stringify(this.currentOrder.get_quantityLine()));
                this.state.useQuantityLine = JSON.parse(JSON.stringify(this.currentOrder.get_useQuantityLine()));
            }
            this._createQuantityLine();
        }
        get selectedComboCategoryId() {
            return this.state.selectedComboCategoryId;
        }
        get productsToDisplay() {
            return this.env.pos.db.get_combo_product_by_category(this.selectedComboCategoryId);
        }
        get maxQuantity(){
            return this.env.pos.db.get_combo_line_by_id(this.selectedComboCategoryId)[3];
        }
        useQuantity(id){
            if(this.state){
                return this.state.useQuantityLine[id] ? this.state.useQuantityLine[id] : 0;
            }
        }
        get currentQuantityLine(){
            if(Object.keys(this.state.quantityLine).length == 0){
                this._createQuantityLine();
            }
            return this.state.quantityLine[this.selectedComboCategoryId];
        }
        get currentOrder(){
            return this.env.pos.get_order();
        }
        get categories() {
            var combo_line_ids = this.props.product.product_combo_ids;
            var categories = [];
            for(var i=0; i< combo_line_ids.length; i++){
                var line = this.env.pos.db.get_combo_line_by_id(combo_line_ids[i]);
                if(line[2] == false){
                    categories.push({'id':line[0], 'name':line[4], 'max':line[3], 'use':this.useQuantity(line[0])});
                }
            }
            return categories;
        }
        get comboLineData(){
            return this.env.pos.db.get_combo_line_by_id(this.selectedComboCategoryId)
        }
        _switchCategory(event) {
            this.state.selectedComboCategoryId = event.detail;
            this.render();
        }
        _createQuantityLine(){
            if(Object.keys(this.state.quantityLine).length == 0){
                var combo_line_ids = this.props.product.product_combo_ids;
                var quantityLine = {};
                for(var i=0; i< combo_line_ids.length; i++){
                    var line = this.env.pos.db.get_combo_line_by_id(combo_line_ids[i]);
                    if(line[2] == false){
                        var value = {};
                        for(var j=0; j< line[1].length; j++){
                            value[line[1][j]]=0;
                        }
                        quantityLine[line[0]] = value;
                    }

                }
                this.state.quantityLine = quantityLine;
                this.currentOrder.get_selected_orderline().set_quantityLine(quantityLine);
            }
        }
        _clickProduct(event){
            var product = event.detail.product;
            if(!this.state.useQuantityLine[this.state.selectedComboCategoryId]){
                this.state.useQuantityLine[this.state.selectedComboCategoryId] = 0;
            }
            if(this.state.useQuantityLine[this.state.selectedComboCategoryId] < this.maxQuantity){
                this.state.useQuantityLine[this.state.selectedComboCategoryId] = this.state.useQuantityLine[this.state.selectedComboCategoryId]+1;
                this.currentQuantityLine[product.id] = this.currentQuantityLine[product.id]+1;

                this.trigger('add-product', {
                    product: product,
                    categoryName: this.comboLineData[4],
                    require: this.comboLineData[2],
                    categoryId: this.comboLineData[0],
                    replaceable: this.comboLineData[7],
                    basePrice: this.comboLineData[8],
                    });

            }
        }
        _clickClear(event){
            var product = event.detail.product;
            if(this.state.useQuantityLine[this.state.selectedComboCategoryId] > 0 && this.currentQuantityLine[product.id] > 0){
                this.state.useQuantityLine[this.state.selectedComboCategoryId] = this.state.useQuantityLine[this.state.selectedComboCategoryId]-1;
                this.trigger('remove-comboline', { product: product, categoryId: this.state.selectedComboCategoryId});
                this.currentQuantityLine[product.id] = this.currentQuantityLine[product.id]-1;
                this.trigger('click-flag');
            }
        }
    }
    ComboProductsWidget.template = 'ComboProductsWidget';

    Registries.Component.add(ComboProductsWidget);

    return ComboProductsWidget;
});
