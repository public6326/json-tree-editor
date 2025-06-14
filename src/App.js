import React, { useState } from "react";
import { Layout, Row, Col, message, Button } from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import JsonInput from "./components/JsonInput";
import TreeDisplay from "./components/TreeDisplay";
import * as XLSX from "xlsx";
import "./App.css";

const { Content } = Layout;

function App() {
  const [treeData, setTreeData] = useState(null);
  const [jsonString, setJsonString] = useState("");
  const [flatData, setFlatData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [deletedKeys, setDeletedKeys] = useState([]);

  const handleJsonSubmit = (jsonData) => {
    setTreeData(jsonData);
    setJsonString(JSON.stringify(jsonData, null, 2));
  };

  const handleExcelParsed = (data, cols) => {
    // 只在上传时初始化 flatData/columns
    if (!flatData.length) {
      const patched = data.map((row) => ({
        ...row,
        _originParentId: row["父级权限id"],
        _originName: row["权限名称"],
      }));
      setFlatData(patched);
    }
    if (!columns.length) {
      setColumns(cols);
    }
  };

  const downloadExcel = () => {
    if (!flatData.length || !columns.length) {
      message.error("没有可导出的数据");
      return;
    }
    const newNameCol = "权限名称（新）";
    const newParentIdCol = "父级权限id（新）";
    const actionCol = "操作";
    const exportData = flatData.map((row) => {
      const result = {};
      result[newNameCol] = row._newName || "";
      result[newParentIdCol] = row._newParentId || "";
      result[actionCol] = row._action || "";
      columns.forEach((col) => {
        result[col] = row[col];
      });
      return result;
    });
    const exportColumns = [newNameCol, newParentIdCol, actionCol, ...columns];
    const ws = XLSX.utils.json_to_sheet(exportData, { header: exportColumns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "tree-data.xlsx");
    message.success("Excel已下载");
  };

  const handleTreeChange = (newData, deletedNodes = []) => {
    setTreeData(newData);
    setJsonString(JSON.stringify(newData, null, 2));
    // 递归收集所有被删除节点及其子节点的 key
    const collectDeletedKeys = (nodes) => {
      let keys = [];
      nodes.forEach((item) => {
        if (item.node && item.node.key) {
          keys.push(item.node.key);
          if (item.node.children && item.node.children.length) {
            // 递归收集子节点
            const walk = (children) => {
              let subKeys = [];
              children.forEach((child) => {
                if (child.key) subKeys.push(child.key);
                if (child.children && child.children.length) {
                  subKeys = subKeys.concat(walk(child.children));
                }
              });
              return subKeys;
            };
            keys = keys.concat(walk(item.node.children));
          }
        }
      });
      return keys;
    };
    const deletedKeySet = new Set(collectDeletedKeys(deletedNodes));
    setDeletedKeys(Array.from(deletedKeySet));
    if (flatData.length && columns.length) {
      const idKey = "权限id";
      const parentIdKey = "父级权限id";
      // 树上节点 key -> {parentId, title}
      const treeMap = {};
      const walk = (nodes, parentId) => {
        nodes.forEach((node) => {
          // parentId 统一转字符串，根节点为 "0"
          const pid =
            parentId === undefined || parentId === null || parentId === ""
              ? "0"
              : String(parentId);
          // title 只取字符串
          const titleStr =
            typeof node.title === "string"
              ? node.title
              : node.title &&
                node.title.props &&
                typeof node.title.props.children === "string"
              ? node.title.props.children
              : "";
          treeMap[node.key] = { parentId: pid, title: titleStr };
          if (node.children && node.children.length) {
            walk(node.children, node.key);
          }
        });
      };
      walk(Array.isArray(newData) ? newData : [newData], "0");
      // 生成新的 flatData
      const newFlat = flatData.map((row) => {
        const key = row[idKey];
        const result = { ...row };
        if (deletedKeySet.has(key)) {
          // 被删除，三列只标记删除
          result._newName = "";
          result._newParentId = "";
          result._action = "删除";
        } else {
          // 未被删除，判断改名/移动
          const treeInfo = treeMap[key];
          if (treeInfo) {
            // 统一类型为字符串
            const originParentId =
              row._originParentId === undefined ||
              row._originParentId === null ||
              row._originParentId === ""
                ? "0"
                : String(row._originParentId);
            // 权限名称（新）只在 title 为字符串且与 _originName 不同才标记
            result._newName =
              treeInfo.title &&
              typeof treeInfo.title === "string" &&
              treeInfo.title !== row._originName
                ? treeInfo.title
                : "";
            result._newParentId =
              treeInfo.parentId !== originParentId ? treeInfo.parentId : "";
            let actions = [];
            if (result._newName) actions.push("改名");
            if (result._newParentId) actions.push("移动");
            result._action = actions.join(",");
          } else {
            result._newName = "";
            result._newParentId = "";
            result._action = "";
          }
        }
        return result;
      });
      setFlatData(newFlat);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        message.success("JSON已复制到剪贴板");
      })
      .catch(() => {
        message.error("复制失败");
      });
  };

  return (
    <Layout className="layout">
      <Content style={{ padding: "8px 8px" }}>
        <div className="site-layout-content">
          <Row gutter={16} className="horizontal-layout">
            <Col span={6}>
              <JsonInput
                onSubmit={handleJsonSubmit}
                onExcelParsed={handleExcelParsed}
                value={jsonString}
                onChange={handleJsonSubmit}
              />
            </Col>

            {treeData ? (
              <>
                <Col span={12}>
                  <TreeDisplay
                    treeData={treeData}
                    onChange={handleTreeChange}
                  />
                </Col>

                <Col span={6}>
                  <div className="json-output">
                    <div className="output-header">
                      <h3>JSON输出</h3>
                      <div className="output-actions">
                        <Button
                          type="primary"
                          icon={<CopyOutlined />}
                          onClick={copyToClipboard}
                          style={{ marginRight: 8 }}
                        >
                          复制 json
                        </Button>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={downloadExcel}
                        >
                          下载 excel
                        </Button>
                      </div>
                    </div>
                    <pre>{jsonString}</pre>
                  </div>
                </Col>
              </>
            ) : (
              <Col span={18}>
                <div className="empty-state">
                  <p>请在左侧输入JSON数据并点击"解析并显示"按钮</p>
                </div>
              </Col>
            )}
          </Row>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
