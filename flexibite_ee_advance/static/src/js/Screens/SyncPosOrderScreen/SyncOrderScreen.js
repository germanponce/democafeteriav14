odoo.define('flexibite_ee_advance.SyncOrderScreen', function (require) {
    'use strict';

    const { useState } = owl.hooks;
    const models = require('point_of_sale.models');
    const Registries = require('point_of_sale.Registries');
    const IndependentToOrderScreen = require('point_of_sale.IndependentToOrderScreen');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener, useAutofocus } = require('web.custom_hooks');
    const { posbus } = require('point_of_sale.utils');
    const { parse } = require('web.field_utils');


    class SyncOrderScreen extends IndependentToOrderScreen {
        constructor() {
            super(...arguments);
            useListener('close-order-screen', this.close);
            useListener('pay-order', this._onPayOrder);
            useListener('click-print', () => this.click_reprint(event));
            useListener('cancel-order', this._onCancelOrder);
            useListener('search', this._onSearch);
            this.searchDetails = {};
            this.filter = null;
            this._initializeSearchFieldConstants();
        }

        _onSearch(event) {
            const searchDetails = event.detail;
            Object.assign(this.searchDetails, searchDetails);
            this.render();
        }
        get DbOrders() {
            return this.env.pos.kitchenScreenData;
        }
        get clients() {
            if (this.state.query && this.state.query.trim() !== '') {
                return this.env.pos.db.search_orders(this.state.query.trim());
            }
        }
        get filteredOrders() {
            const filterCheck = (order) => {
                if (this.filter && this.filter !== 'All Orders') {
                    const screen = order.get_screen_data();
                    return this.filter === this.constants.screenToStatusMap[screen.name];
                }
                return true;
            };
            const { fieldValue, searchTerm } = this.searchDetails;
            const fieldAccessor = this._searchFields[fieldValue];
            const searchCheck = (order) => {
                if (!fieldAccessor) return true;
                const fieldValue = fieldAccessor(order);
                if (fieldValue === null) return true;
                if (!searchTerm) return true;
                return fieldValue && fieldValue.toString().toLowerCase().includes(searchTerm.toLowerCase());
            };
            const predicate = (order) => {
                return filterCheck(order) && searchCheck(order);
            };
            return this.DbOrders.filter(predicate);
        }
        getDate(order) {
            return moment(order.order_datetime).format('YYYY-MM-DD hh:mm A');
        }
        getTotal(order) {
            return this.env.pos.format_currency(order.total);
        }
        get searchBarConfig() {
            return {
                searchFields: this.constants.searchFieldNames,
                filter: { show: true, options: this.filterOptions },
            };
        }
        get filterOptions() {
            return ['All Orders'];
        }
        get _searchFields() {
            var fields = {
                'Receipt/Ref': (order) => order.order_reference,
                'Customer': (order) => order.customer,
                'Table': (order) => order.table,
                'Floor': (order) => order.floor,
                'Order Date (YYYY-MM-DD)': (order) => moment(order.creation_date).locale('en').format('YYYY-MM-DD hh:mm A'),
            };
            return fields;
        }
        _initializeSearchFieldConstants() {
            this.constants = {};
            Object.assign(this.constants, {
                searchFieldNames: Object.keys(this._searchFields),
            });
        }
        async _onCancelOrder({ detail: order }) {
            const { confirmed } = await this.showPopup('ConfirmPopup', {
                title: this.env._t('Cancel Order'),
                body: this.env._t(
                    'Would you like to cancel selected order?'
                ),
            });
            if (confirmed) {
                const { confirmed, payload: inputNote } = await this.showPopup('TextAreaPopup', {
                    startingValue: '',
                    title: this.env._t('Add Cancel Order Reason'),
                });
                var order = await this.rpc({
                    model: 'pos.order',
                    method: 'cancel_pos_order',
                    args: [[order.order_id], inputNote]
                });
            }
        }
        async _onPayOrder({ detail: order }){
            var order = await this.rpc({
                model: 'pos.order',
                method: 'export_for_ui',
                args: [[order.order_id]]
            });
            delete order[0].floor;
            delete order[0].table;
            delete order[0].table_id;
            var newOrder = await   new models.Order({}, { pos: this.env.pos, json: order[0]});
            await newOrder.set_is_from_sync_screen(true);
            await this.env.pos.get("orders").add(newOrder);
            await newOrder.save_to_db();
            await this.env.pos.set('selectedOrder', newOrder, {});
            await this.showScreen('PaymentScreen');
            this.render()
        }

        get_orderlines_from_order(line_ids){
            var self = this;
            var orderLines = [];
            return new Promise(function (resolve, reject) {
                rpc.query({
                    model: 'pos.order.line',
                    method: 'search_read',
                    domain: [['id', 'in', line_ids]],
                }).then(function (order_lines) {
                    resolve(order_lines);
                })
            });
        }

        click_reprint(event) {
            var self = this;
            var selectedOrder = this.env.pos.get_order();
            var order_id = event.detail.order_id;
            selectedOrder.destroy();
            selectedOrder = this.env.pos.get_order();
            var result = self.env.pos.db.get_orders_list_by_id(order_id);
            if (result.partner_id && result.partner_id[0]) {
                var partner = self.env.pos.db.get_partner_by_id(result.partner_id[0])
                if(partner){
                    selectedOrder.set_client(partner);
                }
            }
            if(result.payment_ids.length > 0){
                self.get_journal_from_order(result.payment_ids);
            }
            var journal = self.get_journal_from_order(result.payment_ids);
            selectedOrder.set_amount_return(Math.abs(result.amount_return));
            selectedOrder.set_date_order(result.date_order);
            selectedOrder.set_pos_reference(result.pos_reference);
            if(result.lines.length > 0){
                var order_lines = self.get_orderlines_from_order(result.lines).then(function(order_lines){
                    if(order_lines.length > 0){
                        _.each(order_lines, function(line){
                            var product = self.env.pos.db.get_product_by_id(Number(line.product_id[0]));
                            if(product){
                                selectedOrder.add_product(product, {
                                    quantity: line.qty,
                                    discount: line.discount,
                                    price: line.price_unit,
                                })
                            }
                        })
                    }
                    selectedOrder.set_order_id(order_id);
                    self.showScreen('ReceiptScreen');
                });
            }

        }

        get_journal_from_order(statement_ids) {
            var self = this;
            var order = self.env.pos.get_order();
            var PaymentPromise = new Promise(function(resolve, reject){
                var params = {
                    model: 'pos.payment',
                    method: 'search_read',
                    domain: [['id', 'in', statement_ids]],
                }
                rpc.query(params, {async: false}).then(function(statements){
                    if(statements.length > 0){
                        resolve(statements);
                    }
                });
            })
            PaymentPromise.then(function(statements){
                var order_statements = []
                _.each(statements, function(statement){
                    if(statement.amount > 0){
                        order_statements.push({
                            amount: statement.amount,
                            payment_method: statement.payment_method_id[1],
                        })
                    }
                });
                if(order_statements){
                    order.set_journal(order_statements);
                }else{
                    console.log("Connection lost");
                }
             })
        }

         async click_reorder(order_id){
            var self = this;
            var result = self.env.pos.db.get_orders_list_by_id(order_id);
            var flag = false;
            var order_lines = await self.get_orderlines_from_order(result.lines)
            const { confirmed,payload: selectedLines } = await self.showPopup('ReOrderPopup', {
                                title: self.env._t('Products'), orderlines : order_lines});

            if(confirmed) {
                var currentOrder = self.env.pos.get_order();
                var selected_line_ids = _.pluck(selectedLines, 'id');
                if(selected_line_ids){
                    currentOrder.destroy();
                    currentOrder = self.env.pos.get_order();
                    selected_line_ids.map(function(id){
                        var line = _.find(selectedLines, function(obj) { return obj.id == id});
                        var qty = line.qty;
                        if(line && qty > 0){
                            if(line.product_id && line.product_id[0]){
                                var product = self.env.pos.db.get_product_by_id(line.product_id[0]);
                                if(product){
                                    flag = true;
                                    currentOrder.add_product(product, {
                                        quantity: qty,
                                    });
                                }
                            }
                        }
                    });
                    if(flag){
                        if(result.partner_id[0]){
                            let partner = self.env.pos.db.get_partner_by_id(result.partner_id[0]);
                            currentOrder.set_client(partner);
                        }else{
                            currentOrder.set_client(null);
                        }
                        self.render();
                        self.showScreen('ProductScreen');
                    }
                }
            }
         }
    }
    SyncOrderScreen.template = 'SyncOrderScreen';
    SyncOrderScreen.defaultProps = {
        destinationOrder: null,
        reuseSavedUIState: false,
        ui: {},
    };

    Registries.Component.add(SyncOrderScreen);

    return SyncOrderScreen;
});
