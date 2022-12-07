odoo.define('flexibite_ee_advance.Chrome', function(require) {
    'use strict';

    const Chrome = require('point_of_sale.Chrome');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const core = require('web.core');
    var rpc = require('web.rpc');
    const WebClient = require('web.WebClient');
    const { Gui } = require('point_of_sale.Gui');
    const { useListener } = require('web.custom_hooks');
    const { useRef } = owl.hooks;

    require('bus.BusService');
    var bus = require('bus.Longpolling');
    var cross_tab = require('bus.CrossTab').prototype;
    var session = require('web.session');
    var framework = require('web.framework');
    const { posbus } = require('point_of_sale.utils');

const AsplResChrome = (Chrome) =>
    class extends Chrome {
        constructor() {
            super(...arguments); 
            useListener('click-dine-in', this._clickDineIn);
            useListener('click-take-away', this._clickTakeAway);
            useListener('click-delivery', this._clickDelivery);
            useListener('click-kitchen-screen', this._clickKitchenScreen);
            useListener('click-sync-order-screen', this._clickSyncOrderScreen);
            this.state.orderData = [];
            this.state.orderTypeList = {dineIn: '', takeAway: '', delivery: ''};
            this.state.sData = {dineIn: 0, takeAway: 0, delivery: 0}
            this.state.lastScreen = '';
            this.state.dineIn = true;
            this.state.takeAway = true;
            this.state.delivery = true;
            this.RfidScaneCode = useRef('RfidScaneCoderef')
            core.bus.on('barcode_scanned', this, function (barcode) {
                var RfidCode = {code: barcode, rfid:true}
                if (this.RfidScaneCode.comp !== null){
                    this.RfidScaneCode.comp.barcodeCashierAction(RfidCode)
                }
            });
            useListener('click-rfid',this._clickRfid)
        }
        _clickRfid(){
            console.log('rfid click')
        }
        get isTicketButtonShown() {
            var result =  this.mainScreen.name !== 'CustomOrderScreen' &&
                    this.mainScreen.name !== 'CreateComboScreen' &&
                    this.mainScreen.name !== 'ComboCustomiseProductScreen' &&
                    this.mainScreen.name !== 'KitchenScreen';
            return result;
        }
        get isComboScreen() {
            var result =  this.mainScreen.name === 'CreateComboScreen';
            return result;
        }
        get isCustomiseScreen() {
            var result =  this.mainScreen.name === 'CustomOrderScreen' ||
                    this.mainScreen.name === 'ComboCustomiseProductScreen';
            return result;
        }
        get isKitchenScreen() {
            var result = this.mainScreen.name === 'KitchenScreen';
            return result;
        }

        /* kitchen screen */
        get startScreen() {
            if(this.env.pos.user.kitchen_screen_user === 'cook'){
                return { name: 'KitchenScreen'};
            }
            if (this.env.pos.config.enable_close_session && this.env.pos.config.cash_control && this.env.pos.pos_session.state == 'opening_control') {
                return { name: 'CashControlScreen'};
            } else {
                return super.startScreen;
            }
        }
        get isManager(){
            return this.env.pos.user.kitchen_screen_user === 'manager';
        }
        async start() {
            await super.start();
            if(this.env.pos.pos_session.is_lock_screen){
                $('.ClickLockButton').click();
            }
            if (this.env.pos.config.enable_automatic_lock) {
                this._setIdleTimer();
            }
            this._pollData();
            this._poolDisplayData();
            this.env.pos.set(
                'selectedMaterialCategoryId',
                this.env.pos.config.iface_start_categ_id
                    ? this.env.pos.config.iface_start_categ_id[0]
                    : 0
            );
            var DefaultLocation = this.env.pos.stock_location.filter((location) => location.id === this.env.pos.default_stock_pick_type[0].default_location_src_id[0])[0]
            this.env.pos.set('MeterialLocation', DefaultLocation)
            
        }
        _setIdleTimer() {
            if(this.env.pos.config.enable_automatic_lock){
                var time_interval = this.env.pos.config.time_interval || 3;
                var milliseconds = time_interval * 60000
                setTimeout(() => {
                    var params = {
                        model: 'pos.session',
                        method: 'write',
                        args: [this.env.pos.pos_session.id,{'is_lock_screen' : true}],
                    }
                    rpc.query(params, {async: false}).then(function(result){})
                    $('.lock_button').css('background-color', 'rgb(233, 88, 95)');
                    $('.freeze_screen').addClass("active_state");
                    $(".unlock_button").fadeIn(2000);
                    $('.unlock_button').css('display','block');
                }, milliseconds);
            }
        }
        _pollData() {
            this.env.services['bus_service'].updateOption('pos.order.line',session.uid);
            this.env.services['bus_service'].onNotification(this,this._onNotification);
            this.env.services['bus_service'].startPolling();
            // cross_tab._isRegistered = true;
            // cross_tab._isMasterTab = true;
        }
        _onNotification(notifications){
            var self = this;
            for (var item of notifications) {
                if(item[1].updeted_location_vals_qty){
                    for (var updeted_location_vals_qty of item[1].updeted_location_vals_qty) {
                        var product = self.env.pos.db.get_product_by_id(updeted_location_vals_qty.product_id)
                        if (updeted_location_vals_qty.location_id === this.env.pos.get('MeterialLocation').id) {
                            product.qty_available = updeted_location_vals_qty.quantity
                        }
                    }
                    this.render();
                }
                if(item[1].screen_display_data){
                    if(item[1].new_order){
                        Gui.playSound('bell');
                    }
                    var allOrderLines = {}
                    var order_data = [];
                    var syncOrderList = [];
                    let categoryList = this.env.pos.user.pos_category_ids;
                    self.state.sData['dineIn'] = 0;
                    self.state.sData['takeAway'] = 0;
                    self.state.sData['delivery'] = 0;
                    this.state.orderTypeList = {dineIn: '', takeAway: '', delivery: ''};
                    _.each(item[1].screen_display_data, function(order){
                        var order_line_data = [];
                        if(order.state == 'draft'){
                            let clone = {...order};
                            syncOrderList.push(clone);
                        }
                        var order_line_data = [];
                        _.each(order.order_lines,function(line){
                            allOrderLines[line.id] = line.state;
                            if(line.state != 'Done' && line.state != 'Cancel' && _.contains(categoryList, line.categ_id) && !item[1].manager){
                                order_line_data.push(line);
                            }
                            if(line.state != 'Done' && line.state != 'Cancel' && item[1].manager){
                                order_line_data.push(line);
                            }
                        });
                        order.order_lines = order_line_data;
                        order['display'] = true;
                        if(order.order_lines.length != 0){
                            order_data.push(order);
                        }
                        if(order.order_type == 'Dine In'){
                            self.state.orderTypeList.dineIn = 'Dine In';
                            self.state.sData['dineIn'] += 1;
                            if(!self.state.dineIn){
                                order.display = false;
                            }
                        }else if(order.order_type == 'Take Away'){
                            self.state.orderTypeList.takeAway = 'Take Away';
                            self.state.sData['takeAway'] += 1;
                            if(!self.state.takeAway){
                                order.display = false;
                            }
                        }else if(order.order_type == 'Delivery'){
                            self.state.orderTypeList.delivery = 'Delivery';
                            self.state.sData['delivery'] += 1;
                            if(!self.state.delivery){
                                order.display = false;
                            }
                        }
                    });
                    this.state.orderData = order_data;
                    if(allOrderLines){
                        self.updatePosScreenOrder(allOrderLines);
                    }
                }
                if(item[1].sync_screen_data){
                    this.env.pos.set_kitchen_screen_data(item[1].sync_screen_data);
                }
                if(item[1].remove_order){
                    if(this.env.pos.get_order_list().length > 0){
                        var collection_orders = this.env.pos.get_order_list()[0].collection.models;
                        for (let i = 0; i < collection_orders.length; i++){
                            let collection_order = collection_orders[i];
                            if(item[1].remove_order == collection_order.server_id){
                                collection_order.destroy({ reason: 'abandon' });
                                posbus.trigger('order-deleted');
                            }
                        }
                    }
                }
                if(item[1].cancel_order){
                    if(this.env.pos.get_order_list().length > 0){
                        var collection_orders = this.env.pos.get_order_list()[0].collection.models;
                        for (let i = 0; i < collection_orders.length; i++){
                            let collection_order = collection_orders[i];
                            if(item[1].cancel_order == collection_order.server_id){
                                collection_order.server_id = false;
                                collection_order.destroy({ reason: 'abandon' });
                                posbus.trigger('order-deleted');
                            }
                        }
                    }
                }
                if(item[1].order_line_state){
                    if(this.env.pos.get_order_list().length !== 0){
                        var collection_orders = this.env.pos.get_order_list()[0].collection.models;
                        for (var i = 0; i < collection_orders.length; i++) {
                            var collection_order_lines = collection_orders[i].orderlines.models;
                            _.each(collection_order_lines,function(line){
                                if(line.server_id === item[1].order_line_state.server_id && line.order.name ===  item[1].order_line_state.pos_reference){
                                    line.set_line_state(item[1].order_line_state.state)
                                    line.set_start_time(item[1].order_line_state.start_time)
                                    line.set_end_time(item[1].order_line_state.end_time)
                                    line.set_date_time_duration(item[1].order_line_state.date_time_duration)
                                // }else if(line.product.id == item[1].order_line_state.product_id){
                                }else {
                                    line.set_start_time(item[1].order_line_state.start_time)
                                    line.set_end_time(item[1].order_line_state.end_time)
                                    line.set_date_time_duration(item[1].order_line_state.date_time_duration)
                                }
                            });
                        }
                    }
                }
            }
        }
        updatePosScreenOrder(order_line_data){
                if(this.env.pos.get_order_list().length > 0){
                    var collection_orders = this.env.pos.get_order_list()[0].collection.models;
                    for (let i = 0; i < collection_orders.length; i++){
                        let collectionOrder = collection_orders[i];
                        if(collectionOrder.server_id){
                            for(let line of collectionOrder.orderlines.models){
                                if(line && line.server_id && order_line_data[line.server_id]){
                                    line.set_line_state(order_line_data[line.server_id]);
                                }
                            }
                        }
                    }
                }
            }
        _poolDisplayData(){
            this.env.services['bus_service'].updateOption('customer.display',session.uid);
            this.env.services['bus_service'].onNotification(this,this._onDisplayNotification);
            this.env.services['bus_service'].startPolling();
            cross_tab._isRegistered = true;
            cross_tab._isMasterTab = true;
        }

        _onDisplayNotification(notifications) {
            var self = this;
             for (var notif of notifications) {
                var order = self.env.pos.get_order();
                if(notif[1].rating && order){
                    order.set_rating(notif[1].rating);
                }else if(notif[1].partner_id){
                    var partner_id = notif[1].partner_id;
                    var partner = self.env.pos.db.get_partner_by_id(partner_id);
                    if(partner && order){
                        order.set_client(partner);
                    }else{
                        if(partner_id){
                            var fields = _.find(self.env.pos.models,function(model){
                                             return model.model === 'res.partner';
                                         }).fields;
                            var params = {
                                model: 'res.partner',
                                method: 'search_read',
                                fields: fields,
                                domain: [['id','=',partner_id]],
                            }
                            rpc.query(params, {async: false})
                            .then(function(partner){
                                if(partner && partner.length > 0 && self.env.pos.db.add_partners(partner)){
                                    order.set_client(partner[0]);
                                }else{
                                    alert("partner not loaded in pos.");
                                }
                            });
                        }else{
                            console.info("Partner id not found!")
                        }
                    }
                }
             }
        }
        async _closePos() {
            if(this.env.pos.user.kitchen_screen_user === 'cook'){
                    this.state.uiState = 'CLOSING';
                    this.loading.skipButtonIsShown = false;
                    this.setLoadingMessage(this.env._t('Closing ...'));
                    window.location = '/web/session/logout';
            }
            if(this.env.pos.config.enable_close_session){
                var self = this;
                if(self.mainScreen.name != 'CloseCashControlScreen'){
                    const { confirmed } = await self.showPopup('CloseSessionPopup');
                    if(confirmed){
                        if(self.env.pos.config.cash_control){
                            this.trigger('close-temp-screen');
                            self.get_session_data().then(function(session_data){
                                self.showScreen('CloseCashControlScreen',{'sessionData': session_data});
                            });
                            return;
                        }else{
                            framework.blockUI();
                            await self.closePosSession();
                            if(self.env.pos.config.z_report_pdf){
                                await self.generateZReport();
                            }
                            if(self.env.pos.config.iface_print_via_proxy){
                                await self.generateReceipt();
                            }
                            framework.unblockUI();
                            super._closePos();
                        }
                    }else{
                        return;
                    }
                }else{
                    await super._closePos();
                }
            }
            else{
                await super._closePos();
            }
        }
        _clickDineIn(event){
            var self = this;
            this.state.dineIn = event.detail.dineIn;
            var order_data = []
            _.each(self.state.orderData,function(order){
                if(order.order_type == 'Dine In'){
                    if(self.state.dineIn){
                        order['display'] = true;
                    }else{
                        order['display'] = false;
                    }
                }
                order_data.push(order);
            });
            this.state.orderData = order_data;
        }
        _clickTakeAway(event){
            var self = this;
            this.state.takeAway = event.detail.takeAway;
            var order_data = []
            _.each(self.state.orderData,function(order){
                if(order.order_type == 'Take Away'){
                    if(self.state.takeAway){
                        order['display'] = true;
                    }else{
                        order['display'] = false;
                    }
                }
                order_data.push(order);
            });
            this.state.orderData = order_data;
        }
        _clickDelivery(event){
            var self = this;
            this.state.delivery = event.detail.delivery;
            var order_data = []
            _.each(self.state.orderData,function(order){
                if(order.order_type == 'Delivery'){
                    if(self.state.delivery){
                        order['display'] = true;
                    }else{
                        order['display'] = false;
                    }
                }
                order_data.push(order);
            });
            this.state.orderData = order_data;
        }
        _clickKitchenScreen(){
            if(this.mainScreen.name === 'KitchenScreen'){
                this.showScreen('ProductScreen');
            }else{
                this.showScreen('KitchenScreen');
            }
        }
        // POS Close Session
        async generateZReport(){
            return this.env.pos.do_action('flexibite_ee_advance.pos_z_report',{additional_context:{
                       active_ids:[this.env.pos.pos_session.id],
            }});
        }

        async closePosSession(){
            var params = {
                model: 'pos.session',
                method: 'custom_close_pos_session',
                args:[this.env.pos.pos_session.id]
            }
            return this.rpc(params, {async: false}).then(function(res){});
        }

        async generateReceipt(){
            var self = this;
            if(self.env.pos.config.other_devices){
                var report_name = "flexibite_ee_advance.pos_z_thermal_report_template";
                var params = {
                    model: 'ir.actions.report',
                    method: 'get_html_report',
                    args: [[self.env.pos.pos_session.id], report_name],
                }
                rpc.query(params, {async: false})
                .then(function(report_html){
                    if(report_html && report_html[0]){
                        self.env.pos.proxy.printer.print_receipt(report_html[0]);
                    }
                });
            }
        }

        _clickSyncOrderScreen(){
            this.showScreen('SyncOrderScreen');
        }

        get_session_data(){
            var self = this;
            var session_details = false;
            return new Promise(function (resolve, reject) {
                var params = {
                    model: 'pos.session',
                    method: 'search_read',
                    domain: [['id', '=', self.env.pos.pos_session.id]],
                }
                rpc.query(params, {}).then(function (data) {
                    if(data){
                        session_details = data;
                        resolve(session_details);
                    } else {
                        reject();
                    }
               }, function (type, err) { reject(); });
            });
        }
    };

    Registries.Component.extend(Chrome, AsplResChrome);

    return Chrome;
});
