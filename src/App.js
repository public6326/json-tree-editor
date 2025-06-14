import React, { useState, useRef } from "react";
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
  // 全局累积所有被替换节点
  const replacedNodesRef = useRef([]);

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

  const handleTreeChange = (newData, deletedNodes = [], replacedNodes = []) => {
    setTreeData(newData);
    setJsonString(JSON.stringify(newData, null, 2));

    console.log("handleTreeChange 开始处理");
    console.log("收到的 replacedNodes:", replacedNodes);
    console.log("收到的 deletedNodes:", deletedNodes);

    // 1. 处理删除节点
    const deletedKeySet = new Set();
    // 存储被删除节点的权限id，用于标记其所有子节点
    const deletedPermissionIds = new Set();
    // 存储被删除节点的权限码，用于更精确匹配
    const deletedPermissionCodes = new Set();

    // 递归收集所有被删除节点及其子节点的 key
    const addDeletedKeys = (node) => {
      if (!node || !node.key) return;
      deletedKeySet.add(String(node.key));

      // 添加权限id到集合中
      if (node["权限id"]) {
        deletedPermissionIds.add(String(node["权限id"]));
      }

      // 添加权限码到集合中
      if (node["权限码"]) {
        deletedPermissionCodes.add(String(node["权限码"]));
      }

      // 标记当前节点为删除操作
      if (node["操作"] === undefined) {
        node["操作"] = "删除";
      }

      if (node.children && node.children.length) {
        node.children.forEach(addDeletedKeys);
      }
    };

    // 处理所有删除节点
    deletedNodes.forEach((item) => {
      if (item.node) {
        // 确保节点被标记为删除
        if (item.node["操作"] === undefined) {
          item.node["操作"] = "删除";
        }
        addDeletedKeys(item.node);
      }
    });

    setDeletedKeys(Array.from(deletedKeySet));
    console.log("删除节点keys:", Array.from(deletedKeySet));
    console.log("删除节点权限ids:", Array.from(deletedPermissionIds));
    console.log("删除节点权限码:", Array.from(deletedPermissionCodes));

    // 2. 处理替换节点
    // 全局累积所有替换节点
    const allReplacedNodes = [...replacedNodesRef.current];

    // 添加新的替换节点（去重）
    if (replacedNodes && replacedNodes.length) {
      const existingKeys = new Set(
        allReplacedNodes.map((item) => item.node?.key).filter(Boolean)
      );

      replacedNodes.forEach((item) => {
        if (item.node && item.node.key && !existingKeys.has(item.node.key)) {
          allReplacedNodes.push(item);
          existingKeys.add(item.node.key);
        }
      });

      // 更新引用
      replacedNodesRef.current = allReplacedNodes;
    }

    console.log(
      "累积的替换节点:",
      allReplacedNodes.map((item) => item.node?.key)
    );

    // 3. 构建替换信息映射
    const replacedInfo = {};
    // 创建一个从原始权限id到替换信息的映射
    const originalIdToReplacedInfo = {};
    // 创建一个从权限码到替换信息的映射
    const permissionCodeToReplacedInfo = {};
    allReplacedNodes.forEach((item) => {
      if (item.node && item.node.key) {
        const key = String(item.node.key);
        replacedInfo[key] = {
          newPermissionId: item.node["权限id"],
          originalPermissionId: item.originalPermissionId,
          originalPermissionCode: item.originalPermissionCode,
        };

        // 同时用原始权限id作为键建立映射
        if (item.originalPermissionId) {
          const originalId = String(item.originalPermissionId);
          originalIdToReplacedInfo[originalId] = {
            newPermissionId: item.node["权限id"],
            originalPermissionId: originalId,
            originalPermissionCode: item.originalPermissionCode,
          };
        }

        // 使用权限码作为键建立映射
        if (item.originalPermissionCode) {
          const permissionCode = String(item.originalPermissionCode);
          permissionCodeToReplacedInfo[permissionCode] = {
            newPermissionId: item.node["权限id"],
            originalPermissionId: item.originalPermissionId,
            permissionCode: permissionCode,
          };
          console.log(
            `添加权限码映射: ${permissionCode} -> ${item.node["权限id"]}`
          );
        }
      }
    });

    console.log("替换信息 keys:", Object.keys(replacedInfo));
    console.log("原始权限id映射 keys:", Object.keys(originalIdToReplacedInfo));
    console.log("权限码映射 keys:", Object.keys(permissionCodeToReplacedInfo));

    // 4. 更新 flatData
    if (flatData.length && columns.length) {
      const idKey = "权限id";
      const codeKey = "权限码";

      // 调试：打印 flatData 中的所有 key
      const flatDataKeys = flatData.map((row) => String(row[idKey]));
      const flatDataCodes = flatData.map((row) => String(row[codeKey]));
      console.log("flatData 中的所有 key:", flatDataKeys);
      console.log("flatData 中的所有权限码:", flatDataCodes);

      // 检查 flatData 中是否存在替换信息中的 key
      Object.keys(permissionCodeToReplacedInfo).forEach((code) => {
        const exists = flatDataCodes.includes(code);
        console.log(
          `权限码 ${code} 在 flatData 中${exists ? "存在" : "不存在"}`
        );
      });

      const newFlat = flatData.map((row) => {
        const result = { ...row };
        const key = String(result[idKey]);
        const code = String(result[codeKey]);

        // 调试：打印当前处理的行
        console.log(
          `处理行: key=${key}, 权限码=${code}, 在映射中: ${!!permissionCodeToReplacedInfo[
            code
          ]}`
        );

        // 重置操作字段
        result._newName = "";
        result._newParentId = "";
        result._action = "";

        // 处理删除的节点 - 通过key、父级权限id或权限码判断
        if (
          deletedKeySet.has(key) ||
          (result["父级权限id"] &&
            deletedPermissionIds.has(String(result["父级权限id"]))) ||
          (result["权限码"] &&
            deletedPermissionCodes.has(String(result["权限码"])))
        ) {
          result._action = "删除";
        }
        // 处理替换的节点 - 优先使用权限码匹配
        else if (code && permissionCodeToReplacedInfo[code]) {
          console.log(`标记替换(权限码): ${code}`);
          result._action = "替换";
          if (permissionCodeToReplacedInfo[code].newPermissionId) {
            result[idKey] = permissionCodeToReplacedInfo[code].newPermissionId;
          }
        }
        // 如果权限码没有匹配，尝试使用权限id
        else if (key && originalIdToReplacedInfo[key]) {
          console.log(`标记替换(权限id): ${key}`);
          result._action = "替换";
          if (originalIdToReplacedInfo[key].newPermissionId) {
            result[idKey] = originalIdToReplacedInfo[key].newPermissionId;
          }
        }
        // 处理其他操作（移动和修改）
        else {
          // 查找当前节点是否在树中
          const findNodeInTree = (nodes, targetId) => {
            if (!nodes || !nodes.length) return null;
            for (const node of nodes) {
              if (String(node["权限id"]) === targetId) {
                return node;
              }
              if (node.children) {
                const found = findNodeInTree(node.children, targetId);
                if (found) return found;
              }
            }
            return null;
          };

          const node = findNodeInTree(newData, key);

          // 如果找到节点并且有操作标记
          if (node && node["操作"]) {
            console.log(`发现节点操作: ${key}, 操作: ${node["操作"]}`);
            result._action = node["操作"];

            // 如果是修改操作，记录原始标题
            if (node["操作"] === "修改" && node["原始标题"]) {
              result._newName = node.title;
              console.log(`节点 ${key} 标题被修改为: ${node.title}`);
            }

            // 如果是移动操作，记录新父级ID
            if (node["操作"] === "移动" && node["父级权限id"]) {
              result._newParentId = node["父级权限id"];
              console.log(`节点 ${key} 被移动到新父级: ${node["父级权限id"]}`);
            }
          }
        }

        return result;
      });

      // 输出统计信息
      const replacedCount = newFlat.filter(
        (row) => row._action === "替换"
      ).length;
      const deletedCount = newFlat.filter(
        (row) => row._action === "删除"
      ).length;
      console.log(
        `处理完成: ${replacedCount}行标记为替换, ${deletedCount}行标记为删除`
      );

      // 输出被标记为替换的行
      console.log(
        "被标记为替换的行:",
        newFlat
          .filter((row) => row._action === "替换")
          .map((row) => `${row["权限id"]} (权限码: ${row["权限码"] || "未知"})`)
      );

      setFlatData(newFlat);
    }

    console.log("handleTreeChange 处理结束");
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
