# -*- coding: utf-8 -*-
{
    'name': "Unoobi | u_dpack_morgan",
    'summary': """
        DPACK personalization""",
    'description': """
        DPACK personalization
    """,
    'author': "Unoobi",
    'category': 'Account',
    'version': '0.1',
    'depends': [
        'u_invoice_morgan',
        'contacts',
        'sale_management',
        'stock'
    ],
    'data': [
        # Views
        'views/res_partner_view.xml'
    ],
    'qweb': [],
    'installable': True,
}
