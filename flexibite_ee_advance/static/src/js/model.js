odoo.define('flexibite_ee_advance.model', function (require) {
"use strict";

    const { Context } = owl;
    var models = require('point_of_sale.models');
    var utils = require('web.utils');
    var rpc = require('web.rpc');
    var field_utils = require('web.field_utils');
    var round_di = utils.round_decimals;
    var round_pr = utils.round_precision;

    var exports = {};

    models.load_fields('product.product',['attribute_line_ids','bom_ids','bom_line_ids','is_combo','product_combo_ids','qty_available', 'is_material_monitor', 'material_monitor_qty']);
    models.load_fields("res.users", ['image_1920', 'kitchen_screen_user','pos_category_ids', 'display_amount_during_close_session', 'pin','is_delete_order_line','delete_order_line_reason']);
    models.load_fields("res.partner", ['remaining_wallet_amount']);
    models.load_fields("pos.payment.method", ['jr_use_for']);
    models.load_fields('hr.employee',['rfid_pin']);
    models.load_fields("product.product", ['is_packaging', 'type']);
    models.load_fields('pos.session',['is_lock_screen']);
    
    var _super_paymentline = models.Paymentline.prototype;

    models.PosModel.prototype.models.push(
        {
            model: 'mrp.bom',
            domain: function(self) { return [['available_in_pos', '=', true]]; },
            loaded: function(self, mrp_boms, tmp){
                self.prod_mrp_bom_data = mrp_boms;
                tmp.mrp_bom_ids = [];
                this.bom_by_id = {};
                for(var i = 0, len = mrp_boms.length; i < len; i++){
                    var prod_bom_details = mrp_boms[i];
                    this.bom_by_id[prod_bom_details.id] = prod_bom_details;
                    if(prod_bom_details && prod_bom_details.bom_line_ids){
                        _.each(prod_bom_details.bom_line_ids, function(each_bom_line_id) {
                            tmp.mrp_bom_ids.push(each_bom_line_id);
                        });
                    }
                }
            },
        },{
            model:  'stock.picking.type',
            fields: ['default_location_src_id', 'default_location_dest_id'],
            domain: function(self){ return [['id', '=', self.config.picking_type_id[0]]]; },
            loaded: function(self,default_stock_pick_type){
                self.default_stock_pick_type = default_stock_pick_type;
                // self.db.add_picking_types(stock_pick_typ);
            },
        },{
            model:  'stock.location',
            fields: ['complete_name', 'name'],
            domain: [['usage','=','internal']],
            loaded: function(self,stock_location){
                self.stock_location = stock_location;
            },
        },{
            model: 'mrp.bom.line',
            domain: function(self, tmp) { return [['id', 'in', tmp.mrp_bom_ids]]; },
            fields: ['id','parent_product_tmpl_id','product_id','bom_id','product_qty','replaceable',
                'replaceable_product_ids','product_uom_id','bom_base_price','replaceable_by','replaceable_category_ids'],
            loaded: function(self, mrp_bom_line_data){
                self.prod_bom_line_data = mrp_bom_line_data;
                self.bom_lines = []
                _.each(mrp_bom_line_data,function(each_bom_line_id){
                    self.bom_lines.push(each_bom_line_id);
                });
            },
        },{
            model:  'product.combo',
            loaded: function(self,product_combo){
                self.product_combo = product_combo;
                self.combo_line_data = {};
                _.each(product_combo,function(line){
                    self.combo_line_data[line.id] = [
                        line.id,
                        line.product_ids,
                        line.require,
                        line.no_of_items,
                        line.display_name,
                        line.product_tmpl_id,
                        line.pos_category_id,
                        line.replaceable,
                        line.base_price,
                        ]
                });
                self.db.add_combo_line(self.combo_line_data);
            },
        },{
            model:  'order.type',
            loaded: function(self,order_type){
                self.order_type = order_type;
                self.order_type_data = {};
                _.each(order_type,function(line){
                    self.order_type_data[line.id] = [line.type,line.color]
                });
            },
        },{
            model:  'pos.delivery.service',
            loaded: function(self,delivery_service){
                self.delivery_service = delivery_service;
            },
        },{
            model:  'aspl.gift.card.type',
            fields: ['name'],
            loaded: function(self,card_type){
                self.card_type = card_type;
            },
        },{
            model: 'aspl.gift.card',
            domain: [['is_active', '=', true]],
            loaded: function(self,gift_cards){
                self.db.add_giftcard(gift_cards);
                self.set({'gift_card_order_list' : gift_cards});
            },
        },{
            model: 'aspl.gift.voucher',
            domain: [['is_active', '=', true]],
            fields: ['id', 'voucher_name', 'voucher_amount', 'minimum_purchase', 'expiry_date','redemption_order', 'redemption_customer', 'voucher_code'],
            loaded: function(self,gift_voucher){
                self.gift_vouchers = gift_voucher;
            },
        },{
            model:  'remove.product.reason',
            fields: ['name', 'description'],
            loaded: function(self,remove_product_reason){
                self.remove_product_reason = remove_product_reason;
            },
        },
    );

    var _super_orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({
        initialize: function(attr, options) {
            _super_orderline.initialize.call(this,attr,options);
            this.bom_id = this.product.bom_ids[this.product.bom_ids.length - 1] || null;
            this.materiallines = this.materiallines || [];
            this.combolines = this.combolines || [];
            this.quantityLine = {};
            this.useQuantityLine = {};
            this.state = this.state || 'Waiting';
            this.server_id = this.server_id || false;
            this.mo_id = this.mo_id || false;
            // this.start_date_time = this.start_date_time || false;
            // this.end_date_time = this.end_date_time || false;
            this.line_cid = this.cid || false;
            this.start_time = this.start_time || false;
            this.end_time = this.end_time || false;
            
            this.date_time_duration = this.date_time_duration || false;
        },
        set_server_id: function(server_id){
            this.server_id = server_id;
        },
        get_server_id: function(server_id){
            return this.server_id;
        },
        clone: function(){
            var orderline = _super_orderline.clone.call(this);
            orderline.state = this.state;
            orderline.useQuantityLine = this.useQuantityLine;
            orderline.server_id = this.server_id;
            orderline.line_cid = this.line_cid;
            orderline.mo_id = this.mo_id;
            orderline.quantityLine = this.quantityLine;
            orderline.useQuantityLine = this.useQuantityLine;
            return orderline;
        },
        can_be_merged_with: function(orderline) {
            if (this.state != orderline.state){
                return false
            }else{
                return _super_orderline.can_be_merged_with.apply(this,arguments);
            }
        },
        init_from_JSON: function(json) {
            _super_orderline.init_from_JSON.apply(this,arguments);
            this.server_id = json.server_id;
            this.state = json.state;
            this.mo_id = json.mo_id;
            // this.start_date_time = json.start_date_time;
            // this.end_date_time = json.end_date_time;
            this.start_time = json.start_time;
            this.end_time = json.end_time;
            this.line_cid = json.line_cid;
            this.state = json.state;
            this.date_time_duration = json.date_time_duration;
//            this.materiallines = json.materiallines;
        },
        export_as_JSON: function() {
            var json = _super_orderline.export_as_JSON.call(this);
            var materialLines, comboLines;
            materialLines = [];
            console.log("\n\n 1111111111",this.materiallines, typeof(this.materiallines))
//            _.each(this.materiallines, function(item){
//                console.log("\n\n each item >>>",item)
//                return materialLines.push([0, 0, item.export_as_JSON()]);
//            })
//            this.materiallines.each(_.bind( function(item) {
//                return materialLines.push([0, 0, item.export_as_JSON()]);
//            }, this));
            for(let i = 0; i < this.materiallines.length; i++){
                materialLines.push(this.materiallines[i].export_as_JSON());
            }
            comboLines = [];
            for(let i = 0; i < this.combolines.length; i++){
                comboLines.push(this.combolines[i].export_as_JSON());
            }
            json.quantityLine = this.quantityLine;
            json.useQuantityLine = this.useQuantityLine;
            json.bom_id = this.bom_id;
            json.materiallines = materialLines;
            json.combolines = comboLines;
            json.state = this.get_line_state();
            json.server_id = this.server_id;
            json.line_cid = this.line_cid;
            json.mo_id = this.mo_id;
            json.unit_id = this.product.uom_id;
            // json.start_date_time = this.get_start_date_time();
            // json.end_date_time = this.get_end_date_time();
            json.start_time = this.get_start_time();
            json.end_time = this.get_end_time();
            json.date_time_duration = this.get_date_time_duration();
            return json;
        },
        set_start_time:function(start_time){
            this.start_time = start_time;
            this.trigger('change',this);
        },
        get_start_time:function(){
            return this.start_time;
        },
        set_end_time:function(end_time){
            this.end_time = end_time;
            this.trigger('change',this);
        },
        get_end_time:function(){
            return this.end_time;
        },
        set_date_time_duration:function(date_time_duration){
            this.date_time_duration = date_time_duration;
            this.trigger('change',this);
        },
        get_date_time_duration:function(){
            return this.date_time_duration;
        },
        set_line_state:function(state){
            this.state = state;
            this.trigger('change',this);
        },
        get_line_state:function(){
            return this.state;
        },
        export_for_printing: function(json) {
            var materialLines = [];
            var comboLines = [];
            var self = this;
            const result = _super_orderline.export_for_printing.apply(this, arguments);
            for(let i = 0; i < this.materiallines.length; i++){
                materialLines.push(this.materiallines[i].export_for_printing());
            }
            for(let i = 0; i < this.combolines.length; i++){
                comboLines.push(this.combolines[i].export_for_printing());
            }
            result['materiallines'] = materialLines;
            result['combolines'] = comboLines;
            return result;
        },
        set_materiallines: function(materiallines){
            if(materiallines.length != 0){
                for(var i = 0; i < materiallines.length; i++){
                    materiallines[i].line_id = this.id;
                    this.materiallines.push(materiallines[i].clone())
                }
            }else{
                this.materiallines = [];
            }
        },
        get_materiallines: function(){
            return this.materiallines;
        },
        set_combolines: function(combolines){
            if(combolines.length != 0){
                for(var i = 0; i < combolines.length; i++){
                    this.combolines.push(combolines[i].clone())
                }
            }else{
                this.combolines = [];
            }
        },
        get_combolines: function(){
            return this.combolines;
        },
        set_quantityLine: function(value){
            this.quantityLine = JSON.parse(JSON.stringify(value));
        },
        get_quantityLine: function(){
            return this.quantityLine;
        },
        set_useQuantityLine: function(value){
            this.useQuantityLine = JSON.parse(JSON.stringify(value));
        },
        get_useQuantityLine: function(){
            return this.useQuantityLine;
        },
    });

    models.Paymentline = models.Paymentline.extend({
        initialize: function(attributes, options) {
           var self = this;
           _super_paymentline.initialize.apply(this, arguments);
        },
        set_giftcard_line_code: function(gift_card_code) {
            this.gift_card_code = gift_card_code;
        },
        get_giftcard_line_code: function(){
            return this.gift_card_code;
        },
    });

    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function(attributes,options){
            var self = this;

            this.quantityLine = {};
            this.useQuantityLine = {};

            options  = options || {};

            this.selected_materialline   = undefined;
            this.materiallines     = new MateriallineCollection();

            this.materiallines.on('change',   function(){ this.save_to_db("materialline:change"); }, this);
            this.materiallines.on('add',      function(){ this.save_to_db("materialline:add"); }, this);
            this.materiallines.on('remove',   function(){ this.save_to_db("materialline:remove"); }, this);
            this.set({
                earned_points: this.earned_points || 0.0,
                redeem_points: this.redeem_points || 0.0,
                points_amount: this.points_amount || 0.0,
                ref_reward: this.ref_reward || 0.0,
                ref_customer: this.ref_customer || false,
                refund_ref_order:false,
            });
            this.selected_comboline = undefined;
            this.select_comboproduct = undefined;
            this.giftcard = [];
            this.if_gift_card = false
            this.voucher_redeem = this.voucher_redeem || false
            this.redeem = this.redeem || false
            this.combolines     = new CombolineCollection();
            this.combolines.comparator = function( model ) {
              return model.categoryId, model.p_id;
            }
            this.combolines.on('change',   function(){ this.save_to_db("comboline:change"); }, this);
            this.combolines.on('add',      function(){ this.save_to_db("comboline:add"); }, this);
            this.combolines.on('remove',   function(){ this.save_to_db("comboline:remove"); }, this);
            this.send_to_kitchen = this.send_to_kitchen || false;
            this.type_for_wallet = false;
            this.change_amount_for_wallet = false;
            this.used_amount_from_wallet = false;
            this.rounding = false;
            this.order_list = false;
            this.delivery_service = false;
            this.number_of_print = 1;
            _super_Order.initialize.apply(this, arguments);
            this.temp_increment_number = this.temp_increment_number || this.pos.sessions_increment_number;
            if(this.pos.config.enable_default_customer && this.pos.config.default_customer_id && !this.get_client()) {
                var default_customer = this.pos.config.default_customer_id[0];
                var set_partner = this.pos.db.get_partner_by_id(default_customer);
                if(set_partner){
                    this.set_client(set_partner);
                }
            }
            this.is_from_sync_screen = this.is_from_sync_screen || false;
            this.order_type = this.order_type || self.pos.config.default_type_id[1] || false;
            this.cancle_product_reason = [];
            this.delete_product = false;
            this.server_id = this.server_id || false;
            this.order_state = this.order_state || 'Start';
            this.mirror_image_data();
        },
        set_send_to_kitchen: function(flag){
            this.send_to_kitchen = flag;
            this.trigger('change',this);
        },
        get_send_to_kitchen: function(){
            return this.send_to_kitchen;
        },
        set_server_id: function(server_id){
            this.server_id = server_id;
            this.trigger('change',this);
        },
        get_server_id: function(server_id){
            return this.server_id;
        },
        set_order_status: function(status){
            this.order_state = status;
        },
        get_order_status: function(){
            return this.order_state;
        },
        set_cancle_product_reason:function(cancle_product_reason){
            this.cancle_product_reason = cancle_product_reason;
            this.trigger('change',this);
        },
        get_cancle_product_reason:function(){
            return this.cancle_product_reason;
        },
        set_delete_product:function(delete_product){
            this.delete_product = delete_product;
            this.trigger('change',this);
        },
        set_is_from_sync_screen: function(flag){
            this.is_from_sync_screen = flag;
            this.trigger('change',this);
        },
        get_is_from_sync_screen: function(){
            return this.is_from_sync_screen;
        },
        get_delete_product:function(){
            return this.delete_product;
        },
        get_orderline_by_server_id: function(id){
            var orderlines = this.orderlines.models;
            for(var i = 0; i < orderlines.length; i++){
                if(orderlines[i].server_id === id){
                    return orderlines[i];
                }
            }
            return null;
        },
        get_comboline_by_server_id: function(id){
            var combolines = this.combolines.models;
            for(var i = 0; i < combolines.length; i++){
                if(combolines[i].combo_line === id){
                    return combolines[i];
                }
            }
            return null;
        },
        remove_all_materialline: function(){
            var self = this;
            var lines = this.get_materiallines();
            _.each(lines, function (line) {
                self.remove_materialline(self.get_last_materialline());
            });
        },
        add_product: function(product, options){
            if(this._printed){
                this.destroy();
                return this.pos.get_order().add_product(product, options);
            }
            this.assert_editable();
            options = options || {};
            var line = new models.Orderline({}, {pos: this.pos, order: this, product: product});
            this.fix_tax_included_price(line);

            if (options.materiallines !== undefined){
                line.set_materiallines(options.materiallines);
            }
            if (options.combolines !== undefined){
                line.set_combolines(options.combolines);
            }

            if(options.quantity !== undefined){
                line.set_quantity(options.quantity);
            }
            if(options.price !== undefined){
                line.set_unit_price(options.price);
                this.fix_tax_included_price(line);
            }
            if (options.price_extra !== undefined){
                line.price_extra = options.price_extra;
                line.set_unit_price(line.get_unit_price() + options.price_extra);
                this.fix_tax_included_price(line);
            }
            if(options.lst_price !== undefined){
                line.set_lst_price(options.lst_price);
            }
            if(options.discount !== undefined){
                line.set_discount(options.discount);
            }
            if (options.description !== undefined){
                line.description += options.description;
            }
            if(options.extras !== undefined){
                for (var prop in options.extras) {
                    line[prop] = options.extras[prop];
                }
            }
            if (options.is_tip) {
                this.is_tipped = true;
                this.tip_amount = options.price;
            }
            var to_merge_orderline;
            for (var i = 0; i < this.orderlines.length; i++) {
                if(this.orderlines.at(i).can_be_merged_with(line) && options.merge !== false){
                    to_merge_orderline = this.orderlines.at(i);
                }
            }
            if (to_merge_orderline){
                to_merge_orderline.merge(line);
                this.select_orderline(to_merge_orderline);
            } else {
                this.orderlines.add(line);
                this.select_orderline(this.get_last_orderline());
            }
            if (options.draftPackLotLines) {
                this.selected_orderline.setPackLotLines(options.draftPackLotLines);
            }
            if (this.pos.config.iface_customer_facing_display) {
                this.pos.send_current_order_to_customer_facing_display();
            }
            if(this.pos.config.customer_display){
                this.mirror_image_data();
            }
        },
        mirror_image_data:function(neworder){
            var self = this;
            var client_name = false;
            var order_total = self.get_total_with_tax();
            var change_amount = self.get_change();
            var payment_info = [];
            var paymentlines = self.paymentlines.models;
            if(paymentlines && paymentlines[0]){
                paymentlines.map(function(paymentline){
                    payment_info.push({
                        'name':paymentline.name,
                        'amount':paymentline.amount,
                    });
                });
            }
            var orderLines = [];
            this.orderlines.each(_.bind( function(item) {
                return orderLines.push(item.export_as_JSON());
            }, this));
            if(self.get_client()){
                client_name = self.get_client().name;
            }
            const total = this.get_total_with_tax() || 0;
            const tax = total - this.get_total_without_tax() || 0;
            var vals = {
                'orderLines': orderLines,
                'total': total,
                'tax': tax,
                'client_name':client_name,
                'order_total':order_total,
                'change_amount':change_amount,
                'payment_info':payment_info,
                'enable_customer_rating':self.pos.config.enable_customer_rating,
                'set_customer':self.pos.config.set_customer,
            }
            if(neworder){
                vals['new_order'] = true;
            }
            rpc.query({
                model: 'customer.display',
                method: 'broadcast_data',
                args: [vals],
            })
            .then(function(result) {});
        },
        set_client: function(client){
            _super_Order.set_client.apply(this, arguments);
            if(this.pos.config.customer_display){
                this.mirror_image_data();
            }
        },
        set_rating: function(rating){
            this.rating = rating;
        },
        get_rating: function(){
            return this.rating;
        },
        set_delivery_service: function(delivery_service){
            this.delivery_service = delivery_service;
        },
        get_delivery_service: function(){
            return this.delivery_service;
        },
        /** material line **/
        add_material: function(product, options){
            options = options || {};
            var line = new exports.Materialline({}, {pos: this.pos, order: this, product: product});
            if(options.bom == true){
                line.set_unit_price(0);
                line.set_bom(true);
            }
            if(options.quantity !== undefined){
                line.set_quantity(options.quantity);
            }
            if(options.replaceable !== undefined){
                line.set_replaceable(options.replaceable);
            }
            if(options.product_uom_id !== undefined){
                line.set_product_uom_id(options.product_uom_id);
            }
            if(options.replaceable_ids !== undefined){
                line.set_replaceable_ids(options.replaceable_ids);
            }
            if(options.replaceable_category_ids !== undefined){
                line.set_replaceable_category_ids(options.replaceable_category_ids);
            }
            if(options.replaceable_by !== undefined){
                line.set_replaceable_by(options.replaceable_by);
            }
            if(options.bom_base_price !== undefined){
                line.set_bom_base_price(options.bom_base_price);
            }
            if(options.is_replaced !== undefined){
                line.set_is_replaced(options.is_replaced);
            }
            if(options.replaced_product_id !== undefined){
                line.set_replaced_product_id(options.replaced_product_id);
            }
            if(options.max !== undefined){
                line.set_max(options.max);
            }
            if (options.description !== undefined){
                line.description += options.description;
            }
            if (options.price_extra !== undefined){
                line.set_price_extra(options.price_extra);
                line.set_unit_price(line.get_unit_price() + options.price_extra);
            }
            this.materiallines.add(line);
            this.select_materialline(this.get_last_materialline());
        },
        add_materialline: function(line){
            this.materiallines.add(line);
            this.select_materialline(this.get_last_materialline());
        },
        get_materialline: function(id){
            var materiallines = this.materiallines.models;
            for(var i = 0; i < materiallines.length; i++){
                if(materiallines[i].id === id){
                    return materiallines[i];
                }
            }
            return null;
        },
        get_materiallines: function(){
            return this.materiallines.models;
        },
        get_last_materialline: function(){
            return this.materiallines.at(this.materiallines.length -1);
        },
        remove_materialline: function( line ){
            this.materiallines.remove(line);
            this.select_materialline(this.get_last_materialline());
        },
        get_selected_materialline: function(){
            return this.selected_materialline;
        },
        getNetTotalTaxIncluded: function() {
            var total = this.get_total_with_tax();
            return total;
        },
        set_used_amount_from_wallet: function(used_amount_from_wallet) {
            this.used_amount_from_wallet = used_amount_from_wallet;
        },
        get_used_amount_from_wallet: function() {
            return this.used_amount_from_wallet;
        },
        set_is_rounding: function(rounding) {
            this.rounding = rounding;
        },
        get_is_rounding: function() {
            return this.rounding;
        },
        // gift_card
        set_giftcard: function(giftcard) {
            this.giftcard.push(giftcard);
        },
        get_giftcard: function() {
            return this.giftcard;
        },
        set_recharge_giftcard: function(recharge) {
            this.recharge = recharge;
        },
        get_recharge_giftcard: function(){
            return this.recharge;
        },
        set_redeem_giftcard: function(redeem){
            this.redeem = redeem;
            this.trigger('change',this);
        },
        get_redeem_giftcard: function(){
            return this.redeem;
        },
        set_redeem_giftvoucher: function(voucher_redeem){
            this.voucher_redeem = voucher_redeem;
            this.trigger('change',this);
        },
        get_redeem_giftvoucher: function(){
            return this.voucher_redeem;
        },
        set_refund_ref_order: function(refund_ref_order) {
            this.set('refund_ref_order', refund_ref_order);
        },
        get_refund_ref_order: function() {
            return this.get('refund_ref_order');
        },
        set_refund_order: function(refund_order){
            this.refund_order = refund_order;
            this.trigger('change',this);
        },
        get_refund_order: function(){
            return this.refund_order;
        },
        set_amount_return: function(amount_return) {
            this.set('amount_return', amount_return);
        },
        get_amount_return: function() {
            return this.get('amount_return');
        },
        set_temp_increment_number: function (temp_increment_number) {
            this.temp_increment_number = temp_increment_number;
        },
        get_temp_increment_number: function () {
            return this.temp_increment_number;
        },
        get_change: function(paymentLine) {
            let change = 0.0;
            if (!paymentLine) {
                if(this.get_total_paid() > 0){
                    change = this.get_total_paid() - this.get_total_with_tax();
                }else{
                    change = this.get_amount_return();
                }
            }else {
                change = -this.get_total_with_tax();
                var orderPaymentLines  = this.pos.get_order().get_paymentlines();
                for (let i = 0; i < orderPaymentLines.length; i++) {
                    change += orderPaymentLines[i].get_amount();
                    if (orderPaymentLines[i] === paymentLine) {
                        break;
                    }
                }
            }
            return round_pr(Math.max(0,change), this.pos.currency.rounding);
        },
        // summery replaced_product_id
        set_number_of_print : function(number){
            this.number_of_print = number;
        },
        get_number_of_print : function(){
            return this.number_of_print;
        },
        set_order_summary_report_mode: function(order_summary_report_mode) {
            this.order_summary_report_mode = order_summary_report_mode;
        },
        get_order_summary_report_mode: function() {
            return this.order_summary_report_mode;
        },
        set_product_summary_report :function(product_summary_report) {
            this.product_summary_report = product_summary_report;
        },
        get_product_summary_report: function() {
            return this.product_summary_report;
        },
        set_sales_summary_mode: function(sales_summary_mode) {
            this.sales_summary_mode = sales_summary_mode;
        },
        get_sales_summary_mode: function() {
            return this.sales_summary_mode;
        },
        set_sales_summary_val :function(sales_summary_val) {
            this.sales_summary_val = sales_summary_val;
        },
        get_sales_summary_val: function() {
            return this.sales_summary_val;
        },
        set_receipt: function(custom_receipt) {
            this.custom_receipt = custom_receipt;
        },
        get_receipt: function() {
            return this.custom_receipt;
        },
        set_order_list: function(order_list) {
            this.order_list = order_list;
        },
        get_order_list: function() {
            return this.order_list;
        },
        set_cancle_product_reason:function(cancle_product_reason){
            this.cancle_product_reason = cancle_product_reason;
            this.trigger('change',this);
        },
        get_cancle_product_reason:function(){
            return this.cancle_product_reason;
        },
        set_delete_product:function(delete_product){
            this.delete_product = delete_product;
            this.trigger('change',this);
        },
        get_delete_product:function(){
            return this.delete_product;
        },
        select_materialline: function(line){
            if(line){
                if(line !== this.selected_materialline){
                    if(this.selected_materialline){
                        this.selected_materialline.set_selected(false);
                    }
                    this.selected_materialline = line;
                    this.selected_materialline.set_selected(true);
                }
            }else{
                this.selected_materialline = undefined;
            }
        },
        deselect_materialline: function(){
            if(this.selected_materialline){
                this.selected_materialline.set_selected(false);
                this.selected_materialline = undefined;
            }
        },
        m_get_total_without_tax: function() {
            return round_pr(this.materiallines.reduce((function(sum, materialLine) {
                return sum + materialLine.get_price_without_tax();
            }), 0), this.pos.currency.rounding);
        },

    /* bom data */
        get_bom_product_data_by_p_id: function(tmpl_id, bom_id){
            var bom_lines = this.pos.bom_lines;
            var bom_product_data = [];
            for(var i = 0, len = bom_lines.length; i < len; i++){
                if(bom_lines[i].parent_product_tmpl_id[0] == tmpl_id && bom_lines[i].bom_id[0] == bom_id){
                    bom_product_data.push(
                    {'id':bom_lines[i].product_id[0],
                     'replaceable': bom_lines[i].replaceable,
                     'replaceable_ids' : bom_lines[i].replaceable_product_ids || [],
                     'quantity': bom_lines[i].product_qty,
                     'product_uom_id': bom_lines[i].product_uom_id,
                     'replaceable_by': bom_lines[i].replaceable_by,
                     'replaceable_category_ids': bom_lines[i].replaceable_category_ids || [],
                     'bom_base_price': bom_lines[i].bom_base_price,
                    });

                }
            }
            return bom_product_data;
        },

        /* combo product */
        remove_all_comboline: function(){
            var self = this;
            var lines = this.get_combolines();
            _.each(lines, function (line) {
                self.remove_comboline(self.get_last_comboline());
            });
        },
        add_materialline_in_combo_product: function(materiallines){
            if(materiallines === false){
                this.get_select_comboproduct().set_materiallines([]);
            }else{
                this.get_select_comboproduct().set_materiallines(materiallines);
            }
        },
        set_select_comboproduct: function(line){
            if(line){
                this.select_comboproduct = line;
            }else{
                this.select_comboproduct = undefined;
            }
        },
        get_select_comboproduct: function(){
            return this.select_comboproduct;
        },
        set_type_for_wallet: function(type_for_wallet) {
            this.type_for_wallet = type_for_wallet;
        },
        get_type_for_wallet: function() {
            return this.type_for_wallet;
        },
        set_change_amount_for_wallet: function(change_amount_for_wallet) {
            this.change_amount_for_wallet = change_amount_for_wallet;
        },
        get_change_amount_for_wallet: function() {
            return this.change_amount_for_wallet;
        },
        get_combo_products: function(){
            var combolines = this.combolines.models;
            var list = [];
            for(var i = 0; i < combolines.length; i++){
                list.push(combolines[i].product);
            }
            return list;
        },
        add_combo_product: function(product, options){

            options = options || {};
            var attr = JSON.parse(JSON.stringify(product));
            attr.pos = this.pos;
            attr.order = this;
            var line = new exports.Comboline({}, {pos: this.pos, order: this, product: product});

            if(options.categoryId !== undefined){
                line.set_categoryId(options.categoryId);
            }
            if(options.require !== undefined){
                line.set_require(options.require);
            }
            if(options.categoryName !== undefined){
                line.set_categoryName(options.categoryName);
            }
            if(options.replaceable !== undefined){
                line.set_replaceable(options.replaceable);
            }
            if(options.basePrice !== undefined){
                line.set_basePrice(options.basePrice);
            }
            if(options.quantity !== undefined){
                line.set_quantity(options.quantity);
            }
            if(options.max !== undefined){
                line.set_max(options.max);
            }
            if(options.is_replaced !== undefined){
                line.set_is_replaced(options.is_replaced);
            }
            if(options.replaced_product_id !== undefined){
                line.set_replaced_product_id(options.replaced_product_id);
            }
            if (options.materiallines !== undefined){
                line.set_materiallines(options.materiallines);
            }
            if (options.materiallines_s !== undefined){
                line.set_materiallines_s(options.materiallines_s);
            }
            if (options.replacePrice !== undefined){
                line.set_replacePrice(options.replacePrice);
            }
            if (options.customisePrice !== undefined){
                line.set_customisePrice(options.customisePrice);
            }
            var to_merge_comboline;
            for (var i = 0; i < this.combolines.length; i++) {
                if(this.combolines.at(i).can_be_merged_with(line) && options.merge !== false){
                    to_merge_comboline = this.combolines.at(i);
                }
            }
            if (to_merge_comboline){
                to_merge_comboline.merge(line);
                this.select_comboline(to_merge_comboline);
            } else {
                this.combolines.add(line);
                this.select_comboline(line);
            }
            this.remove_all_materialline();
        },
        add_comboline: function(line){
            this.combolines.add(line);
            this.select_comboline(this.get_last_comboline());
        },
        //improve get_comboline because there is duplicate line present
        get_comboline: function(c_id,p_id){
            var combolines = this.combolines.models;
            for(var i = 0; i < combolines.length; i++){
                if(combolines[i].categoryId == c_id && combolines[i].p_id == p_id){
                    return combolines[i];
                }
            }
            return null;
        },
        get_remaining_comboline: function(line){
            var combolines = this.combolines.models;
            var list = [];
            for(var i = 0; i < combolines.length; i++){
                if(combolines[i].categoryId == line.categoryId && combolines[i].p_id == line.p_id && combolines[i].cid != line.cid){
                    list.push(combolines[i]);
                }
            }
            return list;
        },
        get_combolines: function(){
            return this.combolines.models;
        },
        get_selected_comboline: function(){
            return this.selected_comboline;
        },
        get_last_comboline: function(){
            return this.combolines.at(this.combolines.length -1);
        },
        remove_comboline: function( line ){
            this.combolines.remove(line);
            this.select_comboline(this.get_last_comboline());
        },
        select_comboline: function(line){
            if(line){
                if(line !== this.selected_comboline){
                    if(this.selected_comboline){
                        this.selected_comboline.set_selected(false);
                    }
                    this.selected_comboline = line;
                    this.selected_comboline.set_selected(true);
                }
            }else{
                this.selected_comboline = undefined;
            }
        },
        deselect_comboline: function(){
            if(this.selected_comboline){
                this.selected_comboline.set_selected(false);
                this.selected_comboline = undefined;
            }
        },
        get_last_comboline: function(){
            return this.combolines.at(this.combolines.length -1);
        },
        get_replace_price_difference(difference){
            var rounding = this.pos.currency.rounding;
            return round_pr(difference, rounding);
        },
        c_get_total_without_tax: function() {
            return round_pr(this.combolines.reduce((function(sum, comboline) {
                return sum + comboline.get_base_price();
            }), 0), this.pos.currency.rounding);
        },

        set_quantityLine: function(value){
            this.quantityLine = JSON.parse(JSON.stringify(value));
        },
        get_quantityLine: function(){
            return this.quantityLine;
        },
        set_useQuantityLine: function(value){
            this.useQuantityLine = JSON.parse(JSON.stringify(value));
        },
        get_useQuantityLine: function(){
            return this.useQuantityLine;
        },

        set_order_type: function(order_type){
            this.order_type = order_type;
            this.trigger('change', this);
        },
        get_order_type: function(order_type){
            return this.order_type;
        },
        clone: function(){
            var order = _super_Order.clone.apply(this);
            order.order_type = this.order_type;
            return order;
        },
        export_as_JSON: function(){
            var json = _super_Order.export_as_JSON.apply(this);
            json.order_type = this.order_type;
            json.rating = this.get_rating() || '0';
            json.wallet_type = this.get_type_for_wallet() || false;
            json.change_amount_for_wallet = this.get_change_amount_for_wallet() || 0.00;
            json.used_amount_from_wallet = this.get_used_amount_from_wallet() || 0.00;
            json.amount_paid = this.get_total_paid() - (this.get_change() - Number(this.get_change_amount_for_wallet()));
            json.amount_return = this.get_change() - Number(this.get_change_amount_for_wallet());
            json.amount_due = this.get_due() ? (this.get_due() + Number(this.get_change_amount_for_wallet())): 0.00;
            // gift card
            json.giftcard = this.get_giftcard() || false;
            json.recharge = this.get_recharge_giftcard() || false;
            json.redeem = this.get_redeem_giftcard() || false;
            // gift card
            json.voucher_redeem = this.get_redeem_giftvoucher() || false;
            json.refund_order = this.refund_order || false;
            json.refund_ref_order = this.get_refund_ref_order() || false;
            json.increment_number = this.get_temp_increment_number();
            json.delivery_service = this.get_delivery_service() || false;
            json.cashier_id = this.pos.user.id;
            json.cancle_product_reason = this.get_cancle_product_reason();
            json.delete_product = this.get_delete_product();
            json.is_from_sync_screen = this.is_from_sync_screen;
            // json.product_location = this.get_product_location() || 0;
            json.server_id = this.server_id;
            json.order_state = this.order_state;
            return json;
        },
        init_from_JSON: function(json){
            _super_Order.init_from_JSON.apply(this,arguments);
            this.order_type = json.order_type;
            this.send_to_kitchen     = json.send_to_kitchen;
            this.delivery_service = json.delivery_service;
            this.refund_order = json.refund_order;
            this.temp_increment_number = json.temp_increment_number;
            this.cancle_product_reason = json.cancle_product_reason;
            this.is_from_sync_screen     = json.is_from_sync_screen;
            this.server_id     = json.server_id;
            this.order_state     = json.order_state;
            // this.product_location = json.product_location;
            var orderlines = json.lines;
            for (var i = 0; i < orderlines.length; i++) {
                var orderline = orderlines[i][2];
                if(orderline.material_lines){
                    var materiallines = orderline.material_lines;
                    for (var j = 0; j < materiallines.length; j++) {
                        var materialline = materiallines[j];
                        this.add_materialline(new exports.Materialline({}, {pos: this.pos, order: this, json: materialline}));
                    }
                    this.get_orderline_by_server_id(orderline.server_id).set_materiallines(this.get_materiallines());
                    this.remove_all_materialline();
                }
                else if(orderline.materiallines != 0){
                    var materiallines = orderline.materiallines;
                    for (var j = 0; j < materiallines.length; j++) {
                        var materialline = materiallines[j];
                        this.add_materialline(new exports.Materialline({}, {pos: this.pos, order: this, json: materialline}));
                    }
                    this.get_orderline(orderline.id).set_materiallines(this.get_materiallines());
                    this.remove_all_materialline();
                }
                if(orderline.combo_lines){
                    var combolines = orderline.combo_lines;
                    for (var j = 0; j < combolines.length; j++) {
                        var comboline = combolines[j];
                        this.add_comboline(new exports.Comboline({}, {pos: this.pos, order: this, json: comboline}));
                        if(comboline.material_lines != 0){
                            var materiallines = comboline.material_lines;
                            for (var k = 0; k < materiallines.length; k++) {
                                var materialline = materiallines[k];
                                this.add_materialline(new exports.Materialline({}, {pos: this.pos, order: this, json: materialline}));
                            }
                            this.get_comboline_by_server_id(comboline.server_id).set_materiallines(this.get_materiallines());
                            this.remove_all_materialline();
                        }
                    }
                    this.get_orderline_by_server_id(orderline.server_id).set_combolines(this.get_combolines());
                    this.remove_all_comboline();
                    this.get_orderline_by_server_id(orderline.server_id).set_quantityLine(orderline.quantityLine);
                    this.get_orderline_by_server_id(orderline.server_id).set_useQuantityLine(orderline.useQuantityLine);
                }
                else if(orderline.combolines){
                    var combolines = orderline.combolines;
                    for (var j = 0; j < combolines.length; j++) {
                        var comboline = combolines[j];
                        this.add_comboline(new exports.Comboline({}, {pos: this.pos, order: this, json: comboline}));
                        if(comboline.materiallines){
                            var materiallines = comboline.materiallines;
                            for (var k = 0; k < materiallines.length; k++) {
                                var materialline = materiallines[k];
                                this.add_materialline(new exports.Materialline({}, {pos: this.pos, order: this, json: materialline}));
                            }
                            this.get_comboline(comboline.categoryId, comboline.product_id).set_materiallines(this.get_materiallines());
                            this.remove_all_materialline();
                        }
                    }
                    this.get_orderline(orderline.id).set_combolines(this.get_combolines());
                    this.remove_all_comboline();
                    this.get_orderline(orderline.id).set_quantityLine(orderline.quantityLine);
                    this.get_orderline(orderline.id).set_useQuantityLine(orderline.useQuantityLine);
                }
            }
        },

    });

    var _super_posmodel = models.PosModel;
    models.PosModel = models.PosModel.extend({
        initialize: function(attr, options) {
            _super_posmodel.prototype.initialize.call(this,attr,options);
            this.kitchenScreenData = [];
        },
        set_kitchen_screen_data: function(data){
            this.kitchenScreenData = data;
            this.trigger('change',this);
        },
        get_kitchen_screen_data: function(){
            return this.kitchenScreenData;
        },
        get_product_has_bom : function (product){
            var data = _.filter(this.prod_mrp_bom_data, function(item) {
                 return product.product_tmpl_id == item.product_tmpl_id[0];
            });
            return data.length
        },
        load_server_data: function(){
            var self = this;
            var loaded = _super_posmodel.prototype.load_server_data.call(this);
            loaded.then(function(){
                var session_params = {
                    model: 'pos.session',
                    method: 'search_read',
                    domain: [['state','=','opened']],
                    fields: ['id','name','config_id'],
                    orderBy: [{ name: 'id', asc: true}],
                }
                rpc.query(session_params, {async: false})
                .then(function(sessions){
                    if(sessions && sessions[0]){
                        self.all_pos_session = sessions;
                    }
                });
                var stock_location_params = {
                    model: 'stock.location',
                    method: 'search_read',
                    domain: [['usage','=','internal'],['company_id','=',self.company.id]],
                    fields: ['id','name','company_id','complete_name'],
                }
                rpc.query(stock_location_params, {async: false})
                .then(function(locations){
                    if(locations && locations[0]){
                        self.all_locations = locations;
                    }
                });
                var session_params = {
                    model: 'pos.session',
                    method: 'search_read',
                    domain: [['state','=','opened']],
                    fields: ['id','name','increment_number'],
                    orderBy: [{ name: 'id', asc: true}],
                }
                rpc.query(session_params, {async: false})
                .then(function(sessions){
                    if(sessions && sessions[0]){
                        self.sessions_increment_number = sessions[0].increment_number;
                    }
                });
                var params = {
                    model: 'res.config.settings',
                    method: 'load_settings',
                }
                rpc.query(params).then(function(result){
                    if(result && result[0]) {
                        if(result[0].last_token_number){
                            self.last_token_number = result[0].last_token_number;
                        }
                        if(result[0].generate_token){
                            self.generate_token = true;
                        }
                        if(result[0].restaurant_mode){
                            self.restaurant_mode = result[0].restaurant_mode;
                        }
                        if(result[0].separate_receipt){
                            self.separate_receipt = true;
                        }
                    }
                }).catch(function(){
                    console.log("Connection lost");
                });
                var employee_ids = _.map(self.employees, function(employee){return employee.id;});
                var records = self.rpc({
                    model: 'hr.employee',
                    method: 'get_barcodes_and_pin_hashed',
                    args: [employee_ids],
                });
                records.then(function (employee_data) {
                    self.employees.forEach(function (employee) {
                        var data = _.findWhere(employee_data, {'id': employee.id});
                        if (data !== undefined){
                            employee.rfid_pin = data.rfid_pin;
                            employee.barcode = data.barcode;
                            employee.pin = data.pin;
                        }
                    });
                });
                var records = self.rpc({
                    model: 'pos.order',
                    method: 'broadcast_order_data',
                    args: [false],
                });
                return records.then(function (records) {
                    self.kitchenScreenData = records;
                });
            })
            return loaded
        },
    });

/* ****** Material Line ****** */

    var material_id = 1;
    exports.Materialline = Backbone.Model.extend({

        initialize: function(attr,options){
            this.pos   = options.pos;
            this.order = options.order;
            if (options.json) {
                try {
                    this.init_from_JSON(options.json);
                } catch(error) {
                    console.error('ERROR: attempting to recover product ID', options.json.product_id,
                        'not available in the point of sale. Correct the product or clean the browser cache.');
                }
                return;
            }
            this.line_id = false;
            this.product = options.product;
            this.set_quantity(1);
            this.selected = false;
            this.id = material_id++;
            this.bom = false;
            this.replaceable = false;
            this.replaceable_ids = [];
            this.replaceable_category_ids = [];
            this.replaceable_by = false;
            this.bom_base_price = 0.00;
            this.product_uom_id = [];
            this.is_replaced = false;
            this.replaced_product_id = false;
            this.description = '';
            this.price_extra = 0;
            this.max = 0;
            this.product_uom_id = this.product_uom_id || [];
            if (options.price) {
                this.set_unit_price(options.price);
            } else {
                this.set_unit_price(this.product.get_price(this.order.pricelist, this.get_quantity()));
            }
        },
        set_product_uom_id: function(product_uom_id){
            this.product_uom_id = product_uom_id;
        },
        get_product_uom_id: function(){
            return this.product_uom_id;
        },
        init_from_JSON: function(json) {
            this.product = this.pos.db.get_product_by_id(json.product_id);
            this.line_id = json.line_id || false;
            this.price = json.price;
            this.set_quantity(json.qty, 'do not recompute unit price');
            this.id = json.id ? json.id : material_id++;
            this.bom = json.bom;
            this.replaceable = json.replaceable;
            this.replaceable_ids = json.replaceable_ids;
            this.replaceable_category_ids = json.replaceable_category_ids;
            this.replaceable_by = json.replaceable_by;
            this.bom_base_price = json.bom_base_price;
            this.product_uom_id = json.product_uom_id;
            this.replaced_product_id = json.replaced_product_id;
            this.is_replaced = json.is_replaced;
            this.max = json.max;
            this.description = json.description;
            this.price_extra = json.price_extra;
            material_id = Math.max(this.id+1,material_id);
        },
        export_as_JSON: function() {
            return {
                qty: this.get_quantity(),
                line_id : this.line_id || false,
                price_unit: this.get_unit_price(),
                product_id: this.get_product().id,
                id: this.id,
                bom: this.get_bom(),
                replaceable: this.replaceable,
                replaceable_ids: this.replaceable_ids,
                replaceable_category_ids: this.replaceable_category_ids,
                replaceable_by: this.replaceable_by,
                bom_base_price: this.bom_base_price,
                replaced_product_id: this.replaced_product_id,
                is_replaced: this.is_replaced,
                max: this.max,
                description: this.description,
                price_extra: this.price_extra,
                full_product_name: this.get_full_product_name(),
                product_uom_id: this.get_product_uom_id(),
            };
        },
        export_for_printing: function(){
            return {
                id1: this.id,
                quantity:           this.get_quantity(),
                max:                this.max,
                unit_name:          this.get_unit().name,
                price:              this.get_unit_display_price(),
                product_name:       this.get_product().display_name,
                product_name_wrapped: this.generate_wrapped_product_name(),
                price_display :     this.get_display_price(),
                bom :               this.get_bom(),
                is_replaced:        this.is_replaced,
                replaced_product_name: this.get_replaced_product_name(),
                is_changed: this.get_is_changed(),
                product_uom_id: this.get_product_uom_id(),
            };
        },
        generate_wrapped_product_name: function() {
            var MAX_LENGTH = 30;// 40 * line ratio of .6
            var wrapped = [];
            var name = this.get_full_product_name();
            var current_line = "";

            while (name.length > 0) {
                var space_index = name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);

                  var records = self.rpc({
                    model: 'pos.order',
                    method: 'broadcast_order_data',
                    args: [false],
                });
                return records.then(function (records) {
                    var kitchenScreenData = [];
                    for(var ord of records){
                        if(ord.state == 'draft'){
                            kitchenScreenData.push(ord)
                        }
                    }
                    self.kitchenScreenData = kitchenScreenData;
                });  }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        clone: function(){
            var materialline = new exports.Materialline({},{
                pos: this.pos,
                order: this.order,
                product: this.product,
                price: this.price,
            });
            materialline.line_id = this.line_id;
            materialline.bom_id = this.bom_id;
            materialline.quantity = this.quantity;
            materialline.quantityStr = this.quantityStr;
            materialline.price = this.price;
            materialline.selected = false;
            materialline.bom = this.bom;
            materialline.replaceable = this.replaceable;
            materialline.replaceable_ids = this.replaceable_ids;
            materialline.replaceable_category_ids = this.replaceable_category_ids;
            materialline.replaceable_by = this.replaceable_by;
            materialline.bom_base_price = this.bom_base_price;
            materialline.product_uom_id = this.get_product_uom_id();
            materialline.replaced_product_id = this.replaced_product_id;
            materialline.is_replaced = this.is_replaced;
            materialline.max = this.max;
            materialline.description = this.description;
            materialline.price_extra = this.price_extra;
            materialline.price_extra = this.price_extra;

            return materialline;
        },
        set_quantity: function(quantity, keep_price){
            if(quantity === 'remove'){
                this.order.remove_materialline(this);
                return;
            }else{
                var quant = parseFloat(quantity) || 0;
                var unit = this.get_unit();
                if(unit){
                    if (unit.rounding) {
                        var decimals = this.pos.dp['Product Unit of Measure'];
                        var rounding = Math.max(unit.rounding, Math.pow(10, -decimals));
                        this.quantity    = round_pr(quant, rounding);
                        this.quantityStr = field_utils.format.float(this.quantity, {digits: [69, decimals]});
                    } else {
                        this.quantity    = round_pr(quant, 1);
                        this.quantityStr = this.quantity.toFixed(0);
                    }
                }else{
                    this.quantity    = quant;
                    this.quantityStr = '' + this.quantity;
                }
            }
            this.trigger('change', this);
        },
        get_is_changed: function(){
            if(this.max != this.quantity){
                return true;
            }
            return false;
        },
        set_description: function(description){
            this.description = description || '';
        },
        set_price_extra: function(price_extra){
            this.price_extra = parseFloat(price_extra) || 0.0;
        },
        get_price_extra: function () {
            return this.price_extra;
        },
        set_is_replaced: function(value){
            this.is_replaced = value;
        },
        set_replaced_product_id(value){
            this.replaced_product_id = value;
        },
        get_replaced_product_id(){
            return this.replaced_product_id;
        },
        get_replaced_product_name(){
            if(this.is_replaced){
                return this.pos.db.get_product_by_id(this.replaced_product_id).display_name;
            }
        },
        set_bom: function(value){
            this.bom = true;
        },
        get_bom: function(){
            return this.bom;
        },
        set_replaceable: function(value){
            this.replaceable = value;
        },
        get_replaceable: function(){
            return this.replaceable;
        },
        set_replaceable_ids: function(value){
            this.replaceable_ids = value;
        },
        get_replaceable_ids: function(){
           return this.replaceable_ids;
        },
        set_replaceable_category_ids: function(category_ids){
            this.replaceable_category_ids = category_ids;
        },
        get_replaceable_category_ids: function(){
           return this.replaceable_category_ids;
        },
        set_replaceable_by: function(value){
            this.replaceable_by = value;
        },
        get_replaceable_by: function(){
           return this.replaceable_by;
        },
        set_bom_base_price: function(price){
            this.bom_base_price = price;
        },
        get_bom_base_price: function(){
           return this.bom_base_price;
        },
        set_max: function(value){
            this.max = value;
            var decimals = this.pos.dp['Product Unit of Measure'];
            this.maxStr = field_utils.format.float(this.max, {digits: [69, decimals]});
        },
        get_max: function(){
            return this.max;
        },
        get_max_str: function(){
            return this.maxStr;
        },
        get_quantity: function(){
            return this.quantity;
        },
        get_quantity_str: function(){
            return this.quantityStr;
        },
        get_quantity_str_with_unit: function(){
            var unit = this.get_unit();
            if(unit && !unit.is_pos_groupable){
                return this.quantityStr + ' ' + unit.name;
            }else{
                return this.quantityStr;
            }
        },
        get_full_product_name: function () {
            var full_name = this.is_replaced ? this.get_replaced_product_name() : this.product.display_name;
            if (this.description) {
                full_name += ` (${this.description})`;
            }
            return full_name;
        },
        get_unit: function(){
            var unit_id = this.product.uom_id;
            if(!unit_id){
                return undefined;
            }
            unit_id = unit_id[0];
            if(!this.pos){
                return undefined;
            }
            return this.pos.units_by_id[unit_id];
        },
        get_product: function(){
            return this.product;
        },
        // selects or deselects this materialline
        set_selected: function(selected){
            this.selected = selected;
            this.trigger('change',this);
        },
        // returns true if this materialline is selected
        is_selected: function(){
            return this.selected;
        },
        set_unit_price: function(price){
            this.price = round_di(parseFloat(price) || 0, this.pos.dp['Product Price']);
            this.trigger('change',this);
        },
        get_unit_price: function(){
            var digits = this.pos.dp['Product Price'];
            return parseFloat(round_di(this.price || 0, digits).toFixed(digits));
        },
        get_unit_display_price: function(){
            if (this.pos.config.iface_tax_included === 'total') {
                var quantity = this.quantity;
                this.quantity = 1.0;
                var price = this.get_all_prices().priceWithTax;
                this.quantity = quantity;
                return price;
            } else {
                return this.get_unit_price();
            }
        },
        get_base_price:    function(){
            var rounding = this.pos.currency.rounding;
            return round_pr(this.get_unit_price() * this.get_quantity(), rounding);
        },
        get_display_price_one: function(){
            var rounding = this.pos.currency.rounding;
            var price_unit = this.get_unit_price();

            return round_pr(price_unit, rounding);
        },
        get_display_price: function(){
            return this.get_base_price();
        },
        get_display_price_extra: function(){
            var rounding = this.pos.currency.rounding;
            return round_pr(this.get_price_extra() * this.get_quantity(), rounding);
        },
        get_price_without_tax: function(){
            return this.get_all_prices().priceWithoutTax;
        },
        get_all_prices: function(){
            var self = this;
            var price_unit = this.get_unit_price();
            var product =  this.get_product();
            var base = round_pr(price_unit * this.get_quantity(), this.pos.currency.rounding);
            return {
                "priceWithoutTax": base,
            };
        },
    });
    var MateriallineCollection = Backbone.Collection.extend({
        model: exports.Materialline,
    });

/* ****** Combo Line ****** */

    var comboline_id = 1;
    exports.Comboline = Backbone.Model.extend({

        initialize: function(attr,options){
            this.pos   = options.pos;
            this.order = options.order;
            if (options.json) {
                try {
                    this.init_from_JSON(options.json);
                } catch(error) {
                    console.error('ERROR: attempting to recover product ID', options.json.product_id,
                        'not available in the point of sale. Correct the product or clean the browser cache.');
                }
                return;
            }
            this.combo_line = this.combo_line || false;
            this.product = options.product;
            this.bom_id = this.product.bom_ids[this.product.bom_ids.length - 1] || null;
            this.selected = false;
            this.set_quantity(1);
            this.require = this.get_require();
            this.max = 0;
            this.p_id = options.product.id;
            this.categoryName = this.get_categoryName();
            this.categoryId = this.get_categoryId();
            this.replaceable = false;
            this.basePrice = 0;
            this.customisePrice = 0;
            this.replacePrice = 0;
            this.is_replaced = false;
            this.replaced_product_id = null;
            this.id = comboline_id++;
            this.materiallines = this.materiallines || [];
            this.mo_id = this.mo_id || false;
        },
        init_from_JSON: function(json) {
            this.combo_line = json.server_id,
            this.product = this.pos.db.get_product_by_id(json.product_id);
            this.set_quantity(json.qty);
            this.p_id = this.product.id,
            this.id = json.id ? json.id : comboline_id++;
            this.bom_id = json.bom_id;
            this.categoryName = json.categoryName;
            this.categoryId = json.categoryId;
            this.replaceable = json.replaceable;
            this.basePrice = json.basePrice;
            this.replacePrice = json.replacePrice;
            this.customisePrice = json.customisePrice;
            this.require = json.require;
            this.max = json.max;
            this.is_replaced = json.is_replaced;
            this.replaced_product_id = json.replaced_product_id;
            this.materiallines = [];
            this.mo_id = json.mo_id;
            comboline_id = Math.max(this.id+1,comboline_id);
        },
        export_as_JSON: function() {
            var materialLines;
            materialLines = [];
            for(let i = 0; i < this.materiallines.length; i++){
                materialLines.push(this.materiallines[i].export_as_JSON());
            }
            return {
                combo_line: this.combo_line,
                qty: this.get_quantity(),
                product_id: this.get_product().id,
                bom_id: this.bom_id,
                id: this.id,
                categoryName: this.categoryName,
                categoryId: this.categoryId,
                replaceable: this.replaceable,
                basePrice: this.basePrice,
                replacePrice: this.replacePrice,
                customisePrice: this.customisePrice,
                require: this.require,
                max: this.max,
                is_replaced: this.is_replaced,
                replaced_product_id: this.replaced_product_id,
                materiallines: materialLines,
                full_product_name: this.get_full_product_name(),
                mo_id : this.mo_id,
            };
        },
        export_for_printing: function(){
            var materialLines = [];
            var self = this;
            for(let i = 0; i < this.materiallines.length; i++){
                materialLines.push(this.materiallines[i].export_for_printing());
            }
            return {
                id1: this.id,
                quantity:           this.get_quantity(),
                max:                this.max,
                unit_name:          this.get_unit().name,
                price:              this.get_display_price(),
                product_name:       this.get_product().display_name,
                product_name_wrapped: this.generate_wrapped_product_name(),
                price_display :     this.get_display_price(),
                is_replaced:        this.is_replaced,
                replaced_product_name: this.get_replaced_product_name(),
                materiallines:      materialLines,
            };
        },
        generate_wrapped_product_name: function() {
            var MAX_LENGTH = 30;// 40 * line ratio of .6
            var wrapped = [];
            var name = this.get_full_product_name();
            var current_line = "";

            while (name.length > 0) {
                var space_index = name.indexOf(" ");

                if (space_index === -1) {
                    space_index = name.length;
                }

                if (current_line.length + space_index > MAX_LENGTH) {
                    if (current_line.length) {
                        wrapped.push(current_line);
                    }
                    current_line = "";
                }

                current_line += name.slice(0, space_index + 1);
                name = name.slice(space_index + 1);
            }

            if (current_line.length) {
                wrapped.push(current_line);
            }

            return wrapped;
        },
        clone: function(){
            var comboline = new exports.Comboline({},{
                pos: this.pos,
                order: this.order,
                product: this.product,
            });
            comboline.combo_line = this.combo_line;
            comboline.quantity = this.quantity;
            comboline.bom_id = this.bom_id;
            comboline.quantityStr = this.quantityStr;
            comboline.p_id = this.p_id;
            comboline.categoryName = this.categoryName;
            comboline.categoryId = this.categoryId;
            comboline.replaceable = this.replaceable;
            comboline.basePrice = this.basePrice;
            comboline.replacePrice = this.replacePrice;
            comboline.customisePrice = this.customisePrice;
            comboline.require = this.require;
            comboline.max = this.max;
            comboline.is_replaced = this.is_replaced;
            comboline.replaced_product_id = this.replaced_product_id;
            comboline.materiallines = this.materiallines;
            comboline.mo_id = this.mo_id;
            return comboline;
        },
        can_be_merged_with: function(comboline){
            if( this.get_product().id !== comboline.get_product().id){    //only comboline of the same product can be merged
                return false;
            }else if (this.categoryId !== comboline.categoryId) {
                return false;
            }else{
                return true;
            }
        },
        merge: function(comboline){
            this.set_quantity(this.get_quantity() + comboline.get_quantity());
        },
        set_quantity: function(quantity, keep_price){
            if(quantity === 'remove'){
                this.order.remove_comboline(this);
                return;
            }else{
                var quant = parseFloat(quantity) || 0;
                var unit = this.get_unit();
                if(unit){
                    if (unit.rounding) {
                        var decimals = this.pos.dp['Product Unit of Measure'];
                        var rounding = Math.max(unit.rounding, Math.pow(10, -decimals));
                        this.quantity    = round_pr(quant, rounding);
                        this.quantityStr = field_utils.format.float(this.quantity, {digits: [69, decimals]});
                    } else {
                        this.quantity    = round_pr(quant, 1);
                        this.quantityStr = this.quantity.toFixed(0);
                    }
                }else{
                    this.quantity    = quant;
                    this.quantityStr = '' + this.quantity;
                }
            }
            this.trigger('change', this);
        },
        set_materiallines: function(materiallines){
            if(materiallines.length != 0){
                for(var i = 0; i < materiallines.length; i++){
                    this.materiallines.push(materiallines[i].clone())
                }
            }else{
                this.materiallines = [];
            }

        },
        set_materiallines_s: function(materiallines){
            if(materiallines.length != 0){
                    this.materiallines = materiallines;
            }else{
                this.materiallines = [];
            }

        },
        get_full_product_name: function () {
            var full_name = this.is_replaced ? this.get_replaced_product_name() : this.product.display_name;;
            return full_name;
        },
        get_materiallines: function(){
            return this.materiallines;
        },
        set_max: function(value){
            this.max = value;
            var decimals = this.pos.dp['Product Unit of Measure'];
            this.maxStr = field_utils.format.float(this.max, {digits: [69, decimals]});
        },
        get_max: function(){
            return this.max;
        },
        get_max_str: function(){
            return this.maxStr;
        },
        set_require: function(value){
            this.require = value;
        },
        get_require: function(){
            return this.require;
        },
        set_categoryName: function(value){
            this.categoryName = value;
        },
        get_categoryName: function(){
            return this.categoryName;
        },
        set_categoryId: function(value){
            this.categoryId = value;
        },
        get_categoryId: function(){
            return this.categoryId;
        },
        set_replaceable: function(value){
            this.replaceable = value;
        },
        get_replaceable: function(){
            alert('2')
            return this.replaceable;
        },
        set_basePrice: function(value){
            this.basePrice = value;
        },
        get_basePrice: function(){
            return this.basePrice;
        },
        set_extraPrice: function(value){
            this.extraPrice = value;
        },
        get_extraPrice: function(){
            return this.get_customisePrice() + this.get_replacePrice();
        },
        set_customisePrice: function(value){
            this.customisePrice = value;
        },
        get_customisePrice: function(){
            return this.customisePrice;
        },
        set_replacePrice: function(value){
            this.replacePrice = value;
        },
        get_replacePrice: function(){
            return this.replacePrice;
        },

        get_quantity: function(){
            return this.quantity;
        },
        get_quantity_str: function(){
            return this.quantityStr;
        },
        get_quantity_str_with_unit: function(){
            var unit = this.get_unit();
            if(unit && !unit.is_pos_groupable){
                return this.quantityStr + ' ' + unit.name;
            }else{
                return this.quantityStr;
            }
        },
        set_selected: function(selected){
            this.selected = selected;
            this.trigger('change',this);
        },
        is_selected: function(){
            return this.selected;
        },
        set_is_replaced: function(value){
            this.is_replaced = value;
        },
        set_replaced_product_id(value){
            this.replaced_product_id = value;
        },
        get_replaced_product_id(){
            return this.replaced_product_id;
        },
        get_replaced_product_name(){
            if(this.is_replaced){
                return this.pos.db.get_product_by_id(this.replaced_product_id).display_name;
            }
        },
        get_unit: function(){
            var unit_id = this.product.uom_id;
            if(!unit_id){
                return undefined;
            }
            unit_id = unit_id[0];
            if(!this.pos){
                return undefined;
            }
            return this.pos.units_by_id[unit_id];
        },
        get_product: function(){
            return this.product;
        },
        get_base_price:    function(){
            var rounding = this.pos.currency.rounding;
            return round_pr(this.get_extraPrice() * this.get_quantity(), rounding);
        },
        get_display_price: function(){
            return this.get_base_price();
        },
    });
    var CombolineCollection = Backbone.Collection.extend({
        model: exports.Comboline,
        comparator: 'categoryId',
    });

    /** Customer Display Model (Its need for customer display) **/

    exports.CustomerModel = Backbone.Model.extend({
        initialize: function(attributes) {
            Backbone.Model.prototype.initialize.call(this, attributes);
            var  self = this;

            this.env = this.get('env');
            this.rpc = this.get('rpc');
            this.session = this.get('session');
            this.do_action = this.get('do_action');

            // Business data; loaded from the server at launch
            this.company_logo = null;
            this.company_logo_base64 = '';
            this.currency = null;
            this.company = null;
            this.pos_session = null;
            this.config = null;
            window.posmodel = this;

            var given_config = new RegExp('[\?&]config_id=([^&#]*)').exec(window.location.href);
            this.config_id = odoo.config_id || false;

            this.ready = this.load_server_data().then(function(){
                return;
            });
        },
        after_load_server_data: function(){
            this.load_orders();
            return Promise.resolve();
        },
        // releases ressources holds by the model at the end of life of the posmodel
        destroy: function(){
            // FIXME, should wait for flushing, return a deferred to indicate successfull destruction
            // this.flush();
            this.proxy.disconnect();
            this.barcode_reader.disconnect_from_proxy();
        },
        models: [
        {
            model:  'res.company',
            fields: [ 'currency_id', 'email', 'website', 'company_registry', 'vat', 'name', 'phone', 'partner_id' , 'country_id', 'state_id', 'tax_calculation_rounding_method'],
            ids:    function(self){ return [self.session.user_context.allowed_company_ids[0]]; },
            loaded: function(self,companies){ self.company = companies[0]; },
        },{
            model: 'pos.config',
            fields: [],
            domain: function(self){ return [['id','=', self.config_id]]; },
            loaded: function(self,configs){
                self.config = configs[0];
           },
        },{
            model: 'customer.display',
            fields: [],
            domain: function(self){ return [['config_id','=', self.config_id]]; },
            loaded: function(self,configs){
                self.ad_data = configs;
           },
        },{
            model: 'res.currency',
            fields: ['name','symbol','position','rounding','rate'],
            ids:    function(self){ return [self.config.currency_id[0], self.company.currency_id[0]]; },
            loaded: function(self, currencies){
                self.currency = currencies[0];
                if (self.currency.rounding > 0 && self.currency.rounding < 1) {
                    self.currency.decimals = Math.ceil(Math.log(1.0 / self.currency.rounding) / Math.log(10));
                } else {
                    self.currency.decimals = 0;
                }

                self.company_currency = currencies[1];
            },
        },{
            model:  'decimal.precision',
            fields: ['name','digits'],
            loaded: function(self,dps){
                self.dp  = {};
                for (var i = 0; i < dps.length; i++) {
                    self.dp[dps[i].name] = dps[i].digits;
                }
            },
        },{
            model:  'ad.video',
            fields: ['video_id'],
            domain: function(self){ return [['config_id','=', self.config_id]]; },
            loaded: function(self,result){
                self.ad_video_ids = [];
                for (var i = 0; i < result.length; i++) {
                    self.ad_video_ids.push(result[i].video_id)
                }
            },
        }
        ],

        load_server_data: function(){
            var self = this;
            var tmp = {};

            var loaded = new Promise(function (resolve, reject) {
                function load_model(index) {
                    if (index >= self.models.length) {
                        resolve();
                    } else {
                        var model = self.models[index];

                        var cond = typeof model.condition === 'function'  ? model.condition(self,tmp) : true;
                        if (!cond) {
                            load_model(index+1);
                            return;
                        }

                        var fields =  typeof model.fields === 'function'  ? model.fields(self,tmp)  : model.fields;
                        var domain =  typeof model.domain === 'function'  ? model.domain(self,tmp)  : model.domain;
                        var context = typeof model.context === 'function' ? model.context(self,tmp) : model.context || {};
                        var ids     = typeof model.ids === 'function'     ? model.ids(self,tmp) : model.ids;
                        var order   = typeof model.order === 'function'   ? model.order(self,tmp):    model.order;

                        if( model.model ){
                            var params = {
                                model: model.model,
                                context: _.extend(context, self.session.user_context || {}),
                            };

                            if (model.ids) {
                                params.method = 'read';
                                params.args = [ids, fields];
                            } else {
                                params.method = 'search_read';
                                params.domain = domain;
                                params.fields = fields;
                                params.orderBy = order;
                            }

                            self.rpc(params).then(function (result) {
                                try { // catching exceptions in model.loaded(...)
                                    Promise.resolve(model.loaded(self, result, tmp))
                                        .then(function () { load_model(index + 1); },
                                            function (err) { reject(err); });
                                } catch (err) {
                                    console.error(err.message, err.stack);
                                    reject(err);
                                }
                            }, function (err) {
                                reject(err);
                            });
                        } else if (model.loaded) {
                            try { // catching exceptions in model.loaded(...)
                                Promise.resolve(model.loaded(self, tmp))
                                    .then(function () { load_model(index +1); },
                                        function (err) { reject(err); });
                            } catch (err) {
                                reject(err);
                            }
                        } else {
                            load_model(index + 1);
                        }
                    }
                }

                try {
                    return load_model(0);
                } catch (err) {
                    return Promise.reject(err);
                }
            });

            return loaded;
        },
        format_currency: function(amount, precision) {
            var currency =
                this && this.currency
                    ? this.currency
                    : { symbol: '$', position: 'after', rounding: 0.01, decimals: 2 };

            amount = this.format_currency_no_symbol(amount, precision, currency);

            if (currency.position === 'after') {
                return amount + ' ' + (currency.symbol || '');
            } else {
                return (currency.symbol || '') + ' ' + amount;
            }
        },

        format_currency_no_symbol: function(amount, precision, currency) {
            if (!currency) {
                currency =
                    this && this.currency
                        ? this.currency
                        : { symbol: '$', position: 'after', rounding: 0.01, decimals: 2 };
            }
            var decimals = currency.decimals;

            if (precision && this.dp[precision] !== undefined) {
                decimals = this.dp[precision];
            }

            if (typeof amount === 'number') {
                amount = round_di(amount, decimals).toFixed(decimals);
                amount = field_utils.format.float(round_di(amount, decimals), {
                    digits: [69, decimals],
                });
            }
            return amount;
        },
    });
    return exports;
});
