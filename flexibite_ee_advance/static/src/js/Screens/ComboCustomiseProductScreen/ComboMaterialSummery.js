odoo.define('flexibite_ee_advance.ComboMaterialSummary', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ComboMaterialSummary extends PosComponent {}
    ComboMaterialSummary.template = 'ComboMaterialSummary';

    Registries.Component.add(ComboMaterialSummary);

    return ComboMaterialSummary;
});
