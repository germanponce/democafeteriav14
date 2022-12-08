odoo.define('u_fast_invoicing.models', function (require) {
    "use strict";
    var models = require('point_of_sale.models');
    var session = require('web.session');

    var _super = models.Order;

    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            _super.prototype.initialize.apply(this, arguments, options);
        },

        export_as_JSON: function () {
            var self = this;
            var res = _super.prototype.export_as_JSON.apply(this, arguments);
            if(!self.invoicing_ref) {
                self.invoicing_ref = Math.random().toString(36).slice(2, 12);
            }
            var base_url = self.pos.config.domain || session['web.base.url'];
            self.invoicing_url = base_url + '/autofactura';
            res.invoicing_ref = self.invoicing_ref;
            return res;
        },
        export_for_printing: function () {
            var res = _super.prototype.export_for_printing.apply(this, arguments);
            res.invoicing_ref = this.invoicing_ref;
            res.invoicing_url = this.invoicing_url;
            return res;
        }
    });
});