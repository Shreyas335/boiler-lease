from rest_framework.pagination import PageNumberPagination


class PropertyListingPagination(PageNumberPagination):
    """Pagination for property listing browse endpoint."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_query_param = 'page'
