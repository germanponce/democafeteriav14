odoo.define('flexibite_ee_advance.db', function (require) {
"use strict";

    var core = require('web.core');
    var utils = require('web.utils');
    var DB = require('point_of_sale.DB');
    var core = require('web.core');
    var _t = core._t;

    DB.include({
        init: function(options){
            this._super.apply(this, arguments);
            this.combo_line_by_id = {};
            this.card_by_id = {};
            this.card_sorted = [];
        },
        add_combo_line: function(combo_line_data){
            this.combo_line_by_id = combo_line_data;
        },
        get_combo_line_by_id: function(id){
            return this.combo_line_by_id[id];
        },
        get_combo_product_by_category: function(category_id){
            var product_ids  = this.combo_line_by_id[category_id][1];
            var list = [];
            if (product_ids) {
                for (var i = 0, len = Math.min(product_ids.length, this.limit); i < len; i++) {
                    list.push(this.product_by_id[product_ids[i]]);
                }
            }
            return list;
        },
        decimalSeparator: function() {
            return _t.database.parameters.decimal_point;
        },
        thousandsSeparator: function() {
            return _t.database.parameters.thousands_sep;
        },
        thousandsDecimalChanger: function(amount) {
            if(amount != 0){
                var converted_amount = amount.replace(this.decimalSeparator(), '!').replace(this.thousandsSeparator(), '').replace('!', '.')
                if (!isNaN(parseFloat(converted_amount)) && isFinite(converted_amount)){
                    return parseFloat(converted_amount)
                }
            }else{
                return 0
            }
        },
        notification: function(type, message){
            var types = ['success','warning','info', 'danger'];
            if($.inArray(type.toLowerCase(),types) != -1){
                $('div.span4').remove();
                var newMessage = '';
                message = _t(message);
                switch(type){
                case 'success' :
                    newMessage = '<i class="fa fa-check" aria-hidden="true"></i> '+message;
                    break;
                case 'warning' :
                    newMessage = '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> '+message;
                    break;
                case 'info' :
                    newMessage = '<i class="fa fa-info" aria-hidden="true"></i> '+message;
                    break;
                case 'danger' :
                    newMessage = '<i class="fa fa-ban" aria-hidden="true"></i> '+message;
                    break;
                }
                $('body').append('<div class="span4 pull-right">' +
                        '<div class="alert alert-'+type+' fade">' +
                        newMessage+
                       '</div>'+
                     '</div>');
                $(".alert").removeClass("in").show();
                $(".alert").delay(200).addClass("in").fadeOut(5000);
            }
        },
        get_card_by_id: function(id){
            return this.card_by_id[id];
        },
        _card_search_string: function(gift_card){
            var str =  gift_card.card_no;
            if(gift_card.customer_id){
                str += '|' + gift_card.customer_id[1];
            }
            str = '' + gift_card.id + ':' + str.replace(':','') + '\n';
            return str;
        },
        search_gift_card: function(query){
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g,'.');
                query = query.replace(' ','.+');
                var re = RegExp("([0-9]+):.*?"+query,"gi");
            }catch(e){
                return [];
            }
            var results = [];
            var r;
            for(var i = 0; i < this.limit; i++){
                r = re.exec(this.card_search_string);
                if(r){
                    var id = Number(r[1]);
                    results.push(this.get_card_by_id(id));
                }else{
                    break;
                }
            }
            return results;
        },
        add_giftcard: function(gift_cards){
            var updated_count = 0;
            var new_write_date = '';
            for(var i = 0, len = gift_cards.length; i < len; i++){
                var gift_card = gift_cards[i];
                if (this.card_write_date && this.card_by_id[gift_card.id] && new Date(this.card_write_date).getTime() + 1000 >= new Date(gift_card.write_date).getTime() ) {
                    continue;
                } else if ( new_write_date < gift_card.write_date ) {
                    new_write_date  = gift_card.write_date;
                }
                if (!this.card_by_id[gift_card.id]) {
                    this.card_sorted.push(gift_card.id);
                }
                this.card_by_id[gift_card.id] = gift_card;
                updated_count += 1;
            }
            this.card_write_date = new_write_date || this.card_write_date;
            if (updated_count) {
                // If there were updates, we need to completely
                this.card_search_string = "";
                for (var id in this.card_by_id) {
                    var gift_card = this.card_by_id[id];
                    this.card_search_string += this._card_search_string(gift_card);
                }
            }
            return updated_count;
        },
    });
});