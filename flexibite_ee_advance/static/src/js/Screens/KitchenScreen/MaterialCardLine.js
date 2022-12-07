odoo.define('flexibite_ee_advance.MaterialCardLine', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class MaterialCardLine extends PosComponent {
        constructor() {
            super(...arguments);
        }
        get operation(){
            if(this.isReplaced){
                return 'Replace :'
            }else if(this.isChanged){
                return 'Change :'
            }else if(this.props.line.bom){
                return 'Add :'
            }else if(!this.props.line.bom){
                return 'Add :'
            }
        }
        get isChanged(){
            return this.props.line.max != this.props.line.qty && this.props.line.bom;
        }
        get isReplaced(){
            return this.props.line.replaced_product_name;
        }
        get lineColor(){
            if(this.isReplaced){
                return '#4d74d1';
            }else if(this.isChanged){
                return '#d94e61'
            }else if(this.props.line.bom){
                return '#538d22'
            }else if(!this.props.line.bom){
                return '#538d22'
            }
        }
        get show(){
              return this.isChanged || this.isReplaced || this.props.line.bom || !this.props.line.bom;
        }
    }
    MaterialCardLine.template = 'MaterialCardLine';

    Registries.Component.add(MaterialCardLine);

    return MaterialCardLine;
});
