odoo.define('u_fast_invoicing.framework', function (require) {
    "use strict";
    var core = require('web.core');
    var Widget = require('web.Widget');

    var _t = core._t;

    var messages_by_seconds = function () {
        return [
            [0, _t("Autofacturando...")],
            [20, _t("Seguimos autofacturando...")],
            [60, _t("Seguimos autofacturando...<br />Por favor sea paciente.")],
            [120, _t("No te vayas,<br />seguimos autofacturando...")],
            [300, _t("Puede que no lo creas,<br />pero la aplicación sigue autofacturando...")],
            [420, _t("Tome un minuto para buscar café,<br />porque todavía esta autofacturando...")],
            [3600, _t("Tal vez deba considerar refrescar la aplicación presionando F5...")]
        ];
    };
    var Throbber = Widget.extend({
        template: "FiThrobber",
        xmlDependencies: ['/u_fast_invoicing/static/src/xml/throbber.xml'],
        start: function () {
            this.start_time = new Date().getTime();
            this.act_message();
        },
        act_message: function () {
            var self = this;
            setTimeout(function () {
                if (self.isDestroyed())
                    return;
                var seconds = (new Date().getTime() - self.start_time) / 1000;
                var mes;
                _.each(messages_by_seconds(), function (el) {
                    if (seconds >= el[0])
                        mes = el[1];
                });
                self.$(".oe_throbber_message").html(mes);
                self.act_message();
            }, 1000);
        },
    });
    /** Setup blockui */
    if ($.blockUI) {
        $.blockUI.defaults.baseZ = 1100;
        $.blockUI.defaults.message = '<div class="openerp oe_blockui_spin_container" style="background-color: transparent;">';
        $.blockUI.defaults.css.border = '0';
        $.blockUI.defaults.css["background-color"] = '';
    }

    /**
     * Remove the "accesskey" attributes to avoid the use of the access keys
     * while the blockUI is enable.
     */

    function blockAccessKeys() {
        var elementWithAccessKey = [];
        elementWithAccessKey = document.querySelectorAll('[accesskey]');
        _.each(elementWithAccessKey, function (elem) {
            elem.setAttribute("data-accesskey", elem.getAttribute('accesskey'));
            elem.removeAttribute('accesskey');
        });
    }

    function unblockAccessKeys() {
        var elementWithDataAccessKey = [];
        elementWithDataAccessKey = document.querySelectorAll('[data-accesskey]');
        _.each(elementWithDataAccessKey, function (elem) {
            elem.setAttribute('accesskey', elem.getAttribute('data-accesskey'));
            elem.removeAttribute('data-accesskey');
        });
    }

    var throbbers = [];

    function blockUI() {
        var tmp = $.blockUI.apply($, arguments);
        var throbber = new Throbber();
        throbbers.push(throbber);
        throbber.appendTo($(".oe_blockui_spin_container"));
        $(document.body).addClass('o_ui_blocked');
        blockAccessKeys();
        return tmp;
    }

    function unblockUI() {
        _.invoke(throbbers, 'destroy');
        throbbers = [];
        $(document.body).removeClass('o_ui_blocked');
        unblockAccessKeys();
        return $.unblockUI.apply($, arguments);
    }

    return {
        blockUI: blockUI,
        unblockUI: unblockUI,
    };
});