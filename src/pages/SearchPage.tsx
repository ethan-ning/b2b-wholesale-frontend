import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Layout,
  Typography,
  Select,
  Pagination,
  Spin,
  Empty,
  Divider,
  Button,
  Space,
  Tag,
} from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { PAGE_SIZE, searchProducts } from '../api/catalog';
import { usePagedQuery } from '../hooks/usePagedQuery';
import ProductCard from '../components/ProductCard';
import CategoryTree from '../components/CategoryTree';
import PriceRangeFilter from '../components/PriceRangeFilter';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A–Z' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const [prevQuery, setPrevQuery] = useState(query);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState<number | undefined>();
  const [priceMax, setPriceMax] = useState<number | undefined>();
  const [sort, setSort] = useState('relevance');

  // A new search term starts a fresh lookup, so drop the sidebar filters — stale ones
  // silently narrow the results, often to nothing. Not symmetric: applying a filter
  // refines the current search and keeps the term. Clearing the term is not a new
  // search, so it leaves the sidebar alone. Done during render, not in an effect, so
  // no request fires against the filters being cleared.
  if (query !== prevQuery) {
    setPrevQuery(query);
    if (query) {
      setCategoryId(null);
      setCategoryName(null);
      setPriceMin(undefined);
      setPriceMax(undefined);
    }
  }

  // Paging resets itself whenever any of these change.
  const { data: result, loading, page, setPage } = usePagedQuery(
    (f, p) => searchProducts({ ...f, page: p }),
    { search: query, category: categoryId, priceMin, priceMax, sort }
  );

  function handleCategoryChange(id: number | null, name: string | null) {
    setCategoryId(id);
    setCategoryName(name);
  }

  function handlePriceApply(min: number | undefined, max: number | undefined) {
    setPriceMin(min);
    setPriceMax(max);
  }

  /** Drop the search term but keep the sidebar filters. */
  function clearSearchTerm() {
    setSearchParams({}, { replace: true });
  }

  /** Back to the unfiltered catalog — term, category and price range all dropped. */
  function clearAll() {
    setSearchParams({}, { replace: true });
    setCategoryId(null);
    setCategoryName(null);
    setPriceMin(undefined);
    setPriceMax(undefined);
  }

  const hasFilters = Boolean(query) || categoryId !== null || priceMin !== undefined || priceMax !== undefined;

  return (
    <Layout style={{ minHeight: 'calc(100vh - 64px)', background: '#f0f2f5' }}>
      <Sider
        width={280}
        style={{
          background: '#fff',
          padding: '16px 12px',
          overflowY: 'auto',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <Text strong style={{ fontSize: 13 }}>
          Category
        </Text>
        <div style={{ marginTop: 8 }}>
          <CategoryTree selectedId={categoryId} onChange={handleCategoryChange} />
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <PriceRangeFilter priceMin={priceMin} priceMax={priceMax} onApply={handlePriceApply} />
      </Sider>

      <Content style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            {query ? `Results for "${query}"` : 'All products'}
            {result && (
              <Text type="secondary" style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                ({result.totalElements} found)
              </Text>
            )}
          </Title>
          <Select
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
            style={{ width: 180 }}
            size="small"
          />
        </div>

        {/* The only way out of a search term — it lives in the URL, so the sidebar's
            own resets cannot clear it. */}
        {hasFilters && (
          <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
            {query && (
              <Tag closable onClose={clearSearchTerm} color="blue">
                Search: {query}
              </Tag>
            )}
            {categoryId !== null && (
              <Tag closable onClose={() => handleCategoryChange(null, null)} color="blue">
                Category: {categoryName ?? categoryId}
              </Tag>
            )}
            {(priceMin !== undefined || priceMax !== undefined) && (
              <Tag closable onClose={() => handlePriceApply(undefined, undefined)} color="blue">
                Price: {priceMin !== undefined ? `$${priceMin}` : 'any'} –{' '}
                {priceMax !== undefined ? `$${priceMax}` : 'any'}
              </Tag>
            )}
            <Button size="small" type="link" icon={<CloseCircleOutlined />} onClick={clearAll}>
              Clear all
            </Button>
          </Space>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : result?.content.length === 0 ? (
          <Empty description="No products match your filters.">
            {hasFilters && (
              <Button type="primary" icon={<CloseCircleOutlined />} onClick={clearAll}>
                Clear all and show every product
              </Button>
            )}
          </Empty>
        ) : (
          <>
            {result?.content.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
            {result && result.totalElements > PAGE_SIZE && (
              <Pagination
                current={page + 1}
                total={result.totalElements}
                pageSize={PAGE_SIZE}
                onChange={(p) => setPage(p - 1)}
                style={{ textAlign: 'center', marginTop: 16 }}
                showTotal={(total) => `${total} products`}
              />
            )}
          </>
        )}
      </Content>
    </Layout>
  );
}
