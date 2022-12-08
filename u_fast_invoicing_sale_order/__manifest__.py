# -*- coding: utf-8 -*-
{
    'name': "Unoobi | u_fast_invoicing_sale_order",

    'summary': """
        Invoicing sale order from website""",

    'description': """
        Search and invoice sale orders from website.
    """,

    'author': "Unoobi",

    'category': 'Website',
    'version': '0.1',

    'depends': [
        'u_fast_invoicing'
    ],

    'data': [
        # VIEWS
        'views/inherit_orders_views.xml',
    ],
    'qweb': [],
}
