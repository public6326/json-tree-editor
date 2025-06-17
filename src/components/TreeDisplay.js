import React, { useState, useEffect, useRef } from "react";
import { Tree, Input, Button } from "antd";

function TreeDisplay({ treeData, onChange }) {
  const [data, setData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [inputPos, setInputPos] = useState({ left: 0, top: 0, width: 0 });
  const treeRef = useRef();

  // 记录被删除节点的原父key，便于恢复
  const [deletedNodes, setDeletedNodes] = useState([]); // [{node, originParentKey}]
  const [replacedNodes, setReplacedNodes] = useState([]); // [{node, originParentKey}]

  useEffect(() => {
    if (treeData) {
      const initialData = Array.isArray(treeData) ? treeData : [treeData];
      setData(initialData);
      // 只在首次加载时设置展开，后续不再自动展开
      if (expandedKeys.length === 0) {
        const keys = [];
        const collectKeys = (nodes) => {
          nodes.forEach((node) => {
            if (node.key) keys.push(node.key);
            if (node.children && node.children.length) {
              collectKeys(node.children);
            }
          });
        };
        collectKeys(initialData);
        setExpandedKeys(keys);
      }
    }
  }, [treeData]);

  const onExpand = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
  };

  // 收起二级菜单，只展开根节点
  const collapseSecondLevel = () => {
    const rootKeys = data.map((node) => node.key);
    // 展开根节点和"已删除"节点
    setExpandedKeys([
      ...(rootKeys.includes("deleted-root") ? ["deleted-root"] : []),
      ...rootKeys.filter((k) => k !== "deleted-root"),
    ]);
  };

  const onDrop = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split("-");
    const dropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]);

    console.log("Drop info:", {
      dropKey,
      dragKey,
      dropPosition,
      dropToGap: info.dropToGap,
    });

    const loop = (data, key, callback) => {
      for (let i = 0; i < data.length; i++) {
        if (data[i].key === key) {
          return callback(data[i], i, data);
        }
        if (data[i].children) {
          loop(data[i].children, key, callback);
        }
      }
    };

    const newData = [...data];

    // 查找拖拽节点及其位置
    let dragObj;
    loop(newData, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    // 记录原始父级权限id，用于标记移动操作
    const originalParentId = dragObj["父级权限id"];

    // 标记节点为移动操作的函数
    const markNodeAsMoved = (node, newParentId) => {
      if (originalParentId !== newParentId) {
        // 如果节点已经有操作标记（如替换），保留原有操作并添加移动标记
        const existingOperation = node["操作"] || "";
        if (!existingOperation.includes("移动")) {
          node["操作"] = existingOperation
            ? `${existingOperation},移动`
            : "移动";
        }

        // 更新父级权限id
        node["父级权限id"] = newParentId;

        console.log(
          `节点 ${node.key} 被移动，原父级: ${originalParentId}, 新父级: ${newParentId}`
        );

        // 递归标记所有子节点
        if (node.children && node.children.length > 0) {
          node.children.forEach((child) => markNodeAsMoved(child, newParentId));
        }
      }
    };

    if (!info.dropToGap) {
      // 放置到节点上 - 添加为子节点
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        // 保存父节点的权限id
        console.log("Parent node:", item);
        const newParentId = item["权限id"];
        dragObj["父级权限id"] = newParentId;
        dragObj.children = dragObj.children || [];

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);

        item.children.unshift(dragObj);
      });
    } else if (
      (info.node.props.children || []).length > 0 && // 有子节点
      info.node.props.expanded && // 展开
      dropPosition === 1 // 在第一个子节点之上
    ) {
      loop(newData, dropKey, (item) => {
        item.children = item.children || [];
        // 保存父节点的权限id
        console.log("Parent node:", item);
        const newParentId = item["权限id"];
        dragObj["父级权限id"] = newParentId;
        dragObj.children = dragObj.children || [];

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);

        item.children.unshift(dragObj);
      });
    } else {
      let ar;
      let i;
      loop(newData, dropKey, (item, index, arr) => {
        ar = arr;
        i = index;
      });
      if (dropPosition === -1) {
        ar.splice(i, 0, dragObj);
      } else {
        ar.splice(i + 1, 0, dragObj);
      }

      // 在else分支中也需要标记移动操作
      // 需要找到新的父级权限id
      let newParentId = null;
      // 找到当前数组的父节点
      const findParent = (nodes, targetArray) => {
        for (const node of nodes) {
          if (node.children === targetArray) {
            return node;
          }
          if (node.children) {
            const found = findParent(node.children, targetArray);
            if (found) return found;
          }
        }
        return null;
      };

      const parent = findParent(newData, ar);
      if (parent) {
        newParentId = parent["权限id"];
      }

      // 如果找到了新的父级权限id且与原始不同，标记为移动
      if (newParentId && originalParentId !== newParentId) {
        dragObj["父级权限id"] = newParentId;

        // 标记节点及其所有子节点为移动操作
        markNodeAsMoved(dragObj, newParentId);
      }
    }

    console.log("After drop:", newData);
    setData(newData);
    onChange(newData, deletedNodes, replacedNodes);
  };

  // 删除节点及其子树
  const handleDelete = (key, parentKey = null) => {
    const removeNode = (nodes, key) => {
      let removed = null;
      const filtered = nodes.filter((node) => {
        if (node.key === key) {
          removed = node;
          return false;
        }
        if (node.children) {
          const [newChildren, childRemoved] = removeNode(node.children, key);
          node.children = newChildren;
          if (childRemoved) removed = childRemoved;
        }
        return true;
      });
      return [filtered, removed];
    };
    const [newData, removedNode] = removeNode([...data], key);
    if (removedNode) {
      // 先创建新的 deletedNodes 数组，包含当前要删除的节点
      const updatedDeletedNodes = [
        ...deletedNodes,
        { node: removedNode, originParentKey: parentKey },
      ];

      // 更新状态
      setDeletedNodes(updatedDeletedNodes);
      setData(newData);

      // 使用更新后的 deletedNodes 调用 onChange
      onChange(newData, updatedDeletedNodes, [...replacedNodes]);

      // 标记节点为删除操作
      if (removedNode["操作"] === undefined) {
        removedNode["操作"] = "删除";
      }
    }
  };

  // 递归查找节点
  const findNode = (nodes, k) => {
    for (const n of nodes) {
      if (n.key === k) return n;
      if (n.children) {
        const found = findNode(n.children, k);
        if (found) return found;
      }
    }
    return null;
  };

  // 替换节点及其子树
  const handleReplace = (key, parentKey = null) => {
    console.log("Replace node:", { key, parentKey });
    console.log("Current data:", data);

    // 首先找到父节点，获取其权限码
    let parentPermissionCode = null;
    if (parentKey) {
      const parentNode = findNode(data, parentKey);
      if (parentNode) {
        parentPermissionCode = parentNode["权限码"];
        console.log("Found parent node, 权限码:", parentPermissionCode);
      }
    }

    const removeNode = (nodes, key) => {
      let removed = null;
      const filtered = nodes.filter((node) => {
        if (node.key === key) {
          removed = node;
          return false;
        }
        if (node.children) {
          const [newChildren, childRemoved] = removeNode(node.children, key);
          node.children = newChildren;
          if (childRemoved) removed = childRemoved;
        }
        return true;
      });
      return [filtered, removed];
    };

    const [newData, removedNode] = removeNode([...data], key);
    if (removedNode) {
      console.log("Removed node:", removedNode);
      // 保存原始权限id
      const originalPermissionId = removedNode["权限id"];
      // 保存原始权限码
      const originalPermissionCode = removedNode["权限码"];

      // 标记为替换，但不修改原始权限id
      removedNode["操作"] = "替换";
      // 记录父级权限码，用于导出时添加到"权限码（新）"列
      if (parentPermissionCode) {
        removedNode["父级权限码"] = parentPermissionCode;
      }

      console.log("After replace:", removedNode);

      // 使用Map避免重复
      setReplacedNodes((prev) => {
        const map = new Map();
        prev.forEach((item) => {
          // 确保使用原始的 key 作为 map 的键
          const nodeKey = item.node.key;
          map.set(nodeKey, item);
        });

        // 确保使用原始的 key 作为 map 的键，而不是修改后的权限id
        const nodeKey = key;
        console.log(
          `设置替换节点: key=${nodeKey}, 原权限id=${originalPermissionId}, 权限码=${originalPermissionCode}, 父级权限码=${parentPermissionCode}`
        );

        map.set(nodeKey, {
          node: removedNode,
          originParentKey: parentKey,
          originalPermissionId: originalPermissionId,
          originalPermissionCode: originalPermissionCode,
          parentPermissionCode: parentPermissionCode,
        });
        const updated = Array.from(map.values());

        // Debug
        console.log(
          "更新后的replacedNodes:",
          updated.map((item) => ({
            key: item.node.key,
            originalPermissionId: item.originalPermissionId,
            originalPermissionCode: item.originalPermissionCode,
            parentPermissionCode: item.parentPermissionCode,
          }))
        );

        setData(newData);
        onChange(newData, deletedNodes, updated);
        return updated;
      });
    }
  };

  // 递归查找并恢复已删除节点
  const handleRestore = (key) => {
    // 递归查找目标节点及其父节点信息
    const findAndRemove = (nodes, key) => {
      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        if (item.node.key === key) {
          // 找到目标，移除并返回
          const [removed] = nodes.splice(i, 1);
          return { found: removed, parentOriginKey: item.originParentKey };
        }
        if (item.node.children && item.node.children.length) {
          const result = findAndRemove(
            item.node.children.map((child) => ({
              node: child,
              originParentKey: item.node.key,
            })),
            key
          );
          if (result && result.found) {
            // 从原 children 中移除
            item.node.children = item.node.children.filter(
              (child) => child.key !== key
            );
            return result;
          }
        }
      }
      return null;
    };
    // 拷贝 deletedNodes 以便递归操作
    const deletedCopy = JSON.parse(JSON.stringify(deletedNodes));
    const result = findAndRemove(deletedCopy, key);
    if (!result || !result.found) return;
    const { node } = result.found;
    let parentKey = result.parentOriginKey;
    // 检查当前树中是否有原父节点
    const findNode = (nodes, k) => {
      for (const n of nodes) {
        if (n.key === k) return n;
        if (n.children) {
          const found = findNode(n.children, k);
          if (found) return found;
        }
      }
      return null;
    };
    let dataCopy = [...data];
    if (!findNode(dataCopy, parentKey)) {
      // 如果原父节点不存在，尝试找id=2的统一根节点
      const root2 = findNode(dataCopy, 2) || findNode(dataCopy, "2");
      parentKey = root2 ? root2.key : null;
    }
    const insertNode = (nodes, parentKey, node) => {
      if (!parentKey) return [...nodes, node]; // 插到根节点末尾
      return nodes.map((n) => {
        if (n.key === parentKey) {
          return {
            ...n,
            children: n.children ? [...n.children, node] : [node],
          };
        }
        if (n.children) {
          return { ...n, children: insertNode(n.children, parentKey, node) };
        }
        return n;
      });
    };
    const newData = insertNode(dataCopy, parentKey, node);
    setDeletedNodes(deletedCopy);
    setData(newData);
    // 不修改 expandedKeys，保持原样
    onChange(newData, deletedCopy, replacedNodes);
  };

  // 递归查找并恢复已替换节点
  const handleRestoreReplaced = (key) => {
    const findAndRemove = (nodes, key) => {
      for (let i = 0; i < nodes.length; i++) {
        const item = nodes[i];
        if (item.node.key === key) {
          // 找到目标，移除并返回
          const [removed] = nodes.splice(i, 1);
          return {
            found: removed,
            parentOriginKey: item.originParentKey,
            originalPermissionId: item.originalPermissionId,
          };
        }
        if (item.node.children && item.node.children.length) {
          const result = findAndRemove(
            item.node.children.map((child) => ({
              node: child,
              originParentKey: item.node.key,
              originalPermissionId: child["原始权限id"] || child["权限id"],
            })),
            key
          );
          if (result && result.found) {
            // 从原 children 中移除
            item.node.children = item.node.children.filter(
              (child) => child.key !== key
            );
            return result;
          }
        }
      }
      return null;
    };
    // 拷贝 replacedNodes 以便递归操作
    const replacedCopy = JSON.parse(JSON.stringify(replacedNodes));
    const result = findAndRemove(replacedCopy, key);
    if (!result || !result.found) return;
    const { node } = result.found;
    let parentKey = result.parentOriginKey;

    // 清除操作标记和父级权限码
    delete node["操作"];
    delete node["父级权限码"];

    const findNode = (nodes, k) => {
      for (const n of nodes) {
        if (n.key === k) return n;
        if (n.children) {
          const found = findNode(n.children, k);
          if (found) return found;
        }
      }
      return null;
    };
    let dataCopy = [...data];
    if (!findNode(dataCopy, parentKey)) {
      const root2 = findNode(dataCopy, 2) || findNode(dataCopy, "2");
      parentKey = root2 ? root2.key : null;
    }

    const insertNode = (nodes, parentKey, node) => {
      if (!parentKey) return [...nodes, node];
      return nodes.map((n) => {
        if (n.key === parentKey) {
          return {
            ...n,
            children: n.children ? [...n.children, node] : [node],
          };
        }
        if (n.children) {
          return { ...n, children: insertNode(n.children, parentKey, node) };
        }
        return n;
      });
    };

    const newData = insertNode(dataCopy, parentKey, node);
    setReplacedNodes(replacedCopy);
    setData(newData);
    // 恢复替换节点后，传递完整的 replacedCopy 给 App
    console.log("恢复替换节点后的 replacedCopy:", replacedCopy);
    onChange(newData, deletedNodes, replacedCopy);
  };

  // 展开所有节点
  const handleExpandAll = () => {
    const getAllKeys = (nodes) => {
      let keys = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys = keys.concat(getAllKeys(node.children));
        }
      });
      return keys;
    };
    const allKeys = getAllKeys(data);
    setExpandedKeys(allKeys);
  };

  // 只在保存时才 setData 和 onChange
  const handleEdit = (key, value) => {
    const updateTitle = (nodes) =>
      nodes.map((node) => {
        if (node.key === key) {
          // 如果标题发生变化，标记为修改操作
          const originalTitle = node.title;
          if (originalTitle !== value) {
            console.log(
              `节点 ${key} 标题被修改，原标题: ${originalTitle}, 新标题: ${value}`
            );
            return {
              ...node,
              title: value,
              操作: "修改",
              原始标题: originalTitle,
            };
          }
          return { ...node, title: value };
        }
        if (node.children) {
          return { ...node, children: updateTitle(node.children) };
        }
        return node;
      });
    const newData = updateTitle(data);
    setData(newData);
    setEditingKey(null);
    setEditingValue("");
    setInputPos({ left: 0, top: 0, width: 0 });
    onChange(newData, deletedNodes, replacedNodes);
  };

  // 只在渲染时处理 title
  const processTreeData = (nodes, parentKey = null, inDeleted = false) =>
    nodes.map((node) => {
      let titleContent;
      if (editingKey === node.key) {
        // 编辑时不渲染 title，浮动 Input 由外部渲染
        titleContent = (
          <span style={{ background: "#e6f4ff" }}>{node.title}</span>
        );
      } else {
        titleContent = (
          <span
            onDoubleClick={(e) => {
              setEditingKey(node.key);
              setEditingValue(node.title);
              // 计算节点位置
              const dom = e.target.getBoundingClientRect();
              const treeDom = treeRef.current?.getBoundingClientRect();
              setInputPos({
                left: dom.left - (treeDom?.left || 0),
                top: dom.top - (treeDom?.top || 0),
                width: dom.width,
              });
            }}
            style={{ cursor: "pointer" }}
            title="双击编辑名称"
          >
            {node.title}
            {!inDeleted && node.key !== "deleted" && (
              <>
                <Button
                  size="small"
                  danger
                  style={{ marginLeft: 12, height: 18, width: 40 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(node.key, parentKey);
                  }}
                >
                  删除
                </Button>
                <Button
                  size="small"
                  type="primary"
                  style={{ marginLeft: 8, height: 18, width: 40 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReplace(node.key, parentKey);
                  }}
                >
                  替换
                </Button>
                <span
                  style={{ marginLeft: 8, color: "#888", fontSize: "12px" }}
                >
                  {node["权限码"] && node["权限类型"] ? (
                    <>
                      <span style={{ color: "#1890ff", fontWeight: "bold" }}>
                        {node["权限码"]}
                      </span>{" "}
                      <span style={{ color: "#52c41a" }}>
                        {node["权限类型"]}
                      </span>
                    </>
                  ) : (
                    ""
                  )}
                  {node["原权限id"] && (
                    <span style={{ marginLeft: 8, color: "#ff4d4f" }}>
                      (原权限id: {node["原权限id"]})
                    </span>
                  )}
                  {node["新权限id"] && (
                    <span style={{ marginLeft: 8, color: "#722ed1" }}>
                      (新权限id: {node["新权限id"]})
                    </span>
                  )}
                </span>
              </>
            )}
          </span>
        );
      }
      return {
        ...node,
        title: titleContent,
        children: node.children
          ? processTreeData(node.children, node.key, inDeleted)
          : undefined,
      };
    });

  // 获取完整树数据，包括操作标记
  const getFullTreeData = () => {
    const processNode = (node) => {
      const processedNode = { ...node };
      if (node.children) {
        processedNode.children = node.children.map(processNode);
      }
      return processedNode;
    };

    const base = Array.isArray(data)
      ? data.map(processNode)
      : [processNode(data)];
    if (!deletedNodes.length && !replacedNodes.length) return base;

    console.log("Building full tree data:", {
      base,
      deletedNodes,
      replacedNodes,
    });

    const buildDeletedTree = (nodes) =>
      nodes.map((item) => {
        // 标记当前节点为删除操作
        if (item.node && item.node["操作"] === undefined) {
          item.node["操作"] = "删除";
        }

        // 递归标记所有子节点为删除操作
        const markChildrenAsDeleted = (node) => {
          if (!node) return;

          if (node["操作"] === undefined) {
            node["操作"] = "删除";
          }

          if (node.children && node.children.length) {
            node.children.forEach(markChildrenAsDeleted);
          }
        };

        // 处理子节点
        if (item.node && item.node.children) {
          item.node.children.forEach(markChildrenAsDeleted);
        }

        return {
          ...item.node,
          title: (
            <span>
              {item.node.title}
              <Button
                size="small"
                type="link"
                style={{ marginLeft: 8 }}
                onClick={() => handleRestore(item.node.key)}
              >
                恢复
              </Button>
            </span>
          ),
          children: item.node.children
            ? buildDeletedTree(
                item.node.children.map((child) => ({
                  node: child,
                  originParentKey: item.node.key,
                }))
              )
            : undefined,
        };
      });

    const buildReplacedTree = (nodes) =>
      nodes.map((item) => {
        // 新增：渲染时带出原权限id和新权限id
        const originalId = item.originalPermissionId;
        const newId = item.node["权限id"];
        return {
          ...item.node,
          title: (
            <span>
              {item.node.title}
              <span style={{ marginLeft: 8, color: "#ff4d4f" }}>
                {item.node["父级权限码"]
                  ? `(新权限码: ${item.node["父级权限码"]})`
                  : ""}
              </span>
              <span style={{ marginLeft: 8, color: "#722ed1" }}>
                {newId && originalId && newId !== originalId
                  ? `(新权限id: ${newId})`
                  : ""}
              </span>
              <Button
                size="small"
                type="link"
                style={{ marginLeft: 8 }}
                onClick={() => handleRestoreReplaced(item.node.key)}
              >
                恢复
              </Button>
            </span>
          ),
          children: item.node.children
            ? buildReplacedTree(
                item.node.children.map((child) => ({
                  node: child,
                  originParentKey: item.node.key,
                  originalPermissionId: child["原始权限id"] || child["权限id"],
                }))
              )
            : undefined,
        };
      });

    const result = [
      ...base,
      {
        key: "deleted-root",
        title: "已删除",
        children: buildDeletedTree(deletedNodes),
      },
      {
        key: "replaced-root",
        title: "已替换",
        children: buildReplacedTree(replacedNodes),
      },
    ];

    console.log("Final tree data:", result);
    return result;
  };

  // 递归拍平树结构，包含"已替换"节点
  function flattenTree(nodes, parentId = "", isInDeletedRoot = false) {
    let result = [];
    nodes.forEach((node) => {
      // 检查是否在"已删除"根节点下
      if (node.key === "deleted-root") {
        if (node.children && node.children.length) {
          // 传递 isInDeletedRoot = true 标记进入已删除区域
          result = result.concat(flattenTree(node.children, "", true));
        }
        return;
      } else if (node.key === "replaced-root") {
        if (node.children && node.children.length) {
          result = result.concat(flattenTree(node.children, "", false));
        }
        return;
      }

      const { children, ...rest } = node;
      rest["父级权限id"] = parentId;

      // 如果节点在"已删除"根节点下，标记为"删除"
      if (isInDeletedRoot) {
        rest["操作"] = "删除";
      }

      result.push(rest);
      if (children && children.length) {
        // 传递 isInDeletedRoot 参数，保持删除状态
        result = result.concat(
          flattenTree(children, node["权限id"], isInDeletedRoot)
        );
      }
    });
    return result;
  }

  // 导出 Excel 逻辑
  const exportToExcel = () => {
    // 使用XLSX库
    const XLSX = require("xlsx");

    // 获取完整树数据并拍平
    const treeData = getFullTreeData();
    const flatRows = flattenTree(treeData);

    console.log("Exporting data:", flatRows);

    // 导出数据
    const exportData = flatRows.map((row) => ({
      权限码: row["权限码"] || "",
      权限名称: row["权限名称"] || row.title || "",
      权限类型: row["权限类型"] || "",
      权限id: row["权限id"] || row.key || "",
      父级权限名称: row["父级权限名称"] || "",
      父级权限id: row["父级权限id"] || "",
      权限路径: row["权限路径"] || "",
      是否有子节点:
        row["是否有子节点"] ||
        (row.children && row.children.length ? "是" : "否"),
      站点: row["站点"] || "",
      操作: row["操作"] || "",
    }));

    const exportColumns = [
      "权限码",
      "权限名称",
      "权限类型",
      "权限id",
      "父级权限名称",
      "父级权限id",
      "权限路径",
      "是否有子节点",
      "站点",
      "操作",
    ];

    const ws = XLSX.utils.json_to_sheet(exportData, { header: exportColumns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "tree-data.xlsx");

    console.log("Excel exported successfully");
  };

  return (
    <div
      className="tree-display"
      style={{ position: "relative" }}
      ref={treeRef}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "left",
        }}
      >
        <h2 style={{ margin: 0 }}>树形结构</h2>
        <div className="tree-actions">
          <Button
            style={{ marginLeft: 20 }}
            size="small"
            onClick={collapseSecondLevel}
          >
            收起二级节点
          </Button>
          <Button
            size="small"
            onClick={handleExpandAll}
            style={{ marginLeft: 8 }}
          >
            展开所有节点
          </Button>
        </div>
      </div>
      <div className="tree-container">
        <Tree
          className="draggable-tree"
          draggable
          blockNode
          onDragStart={() => {}}
          onDrop={onDrop}
          showLine
          expandedKeys={expandedKeys}
          onExpand={onExpand}
          treeData={processTreeData(getFullTreeData(), null, false)}
          height={window.innerHeight - 120}
        />
        {editingKey && (
          <Input
            size="small"
            autoFocus
            value={editingValue}
            style={{
              position: "absolute",
              left: inputPos.left,
              top: inputPos.top,
              width: 150,
              zIndex: 10,
            }}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleEdit(editingKey, editingValue)}
            onPressEnter={() => handleEdit(editingKey, editingValue)}
          />
        )}
      </div>
    </div>
  );
}

export default TreeDisplay;
